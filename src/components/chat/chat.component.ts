import { Component, ChangeDetectionStrategy, signal, effect, ElementRef, ViewChild, NgZone, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../../services/gemini.service';
import { Message } from '../../models/message.model';

@Component({
  selector: 'app-chat',
  imports: [CommonModule],
  templateUrl: './chat.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent implements OnDestroy {
  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  // FIX: Use inject() function for dependency injection as per modern Angular best practices.
  private geminiService = inject(GeminiService);
  private zone = inject(NgZone);

  messages = signal<Message[]>([]);
  isListening = signal(false);
  isProcessing = signal(false);
  error = this.geminiService.error;
  
  private recognition: any;
  private synth = window.speechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    this.setupSpeechRecognition();
    this.loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = this.loadVoices;
    }
    
    // Initial greeting
    if (!this.error()) {
        const initialMessage = "Hello! I'm Alex. I'm here to help you practice your English. Tap the microphone and let's start with a simple question: How was your day?";
        this.messages.set([{ sender: 'ai', text: initialMessage }]);
        setTimeout(() => this.speak(initialMessage), 100);
    }
    
    effect(() => {
      this.messages(); 
      this.scrollToBottom();
    });
  }

  private loadVoices = () => {
    this.voices = this.synth.getVoices().filter(voice => voice.lang.startsWith('en'));
  }

  private setupSpeechRecognition() {
    try {
      // FIX: Cast window to `any` to access the experimental SpeechRecognition API, which is not in standard DOM typings.
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        this.error.set("Speech Recognition API is not supported in this browser.");
        return;
      }
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false; // We want to process after each phrase.
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.zone.run(() => this.isListening.set(true));
      };

      this.recognition.onend = () => {
        this.zone.run(() => this.isListening.set(false));
      };

      this.recognition.onerror = (event: any) => {
        this.zone.run(() => {
          console.error('Speech recognition error', event.error);
          this.error.set(`Speech recognition error: ${event.error}`);
          this.isListening.set(false);
        });
      };

      this.recognition.onresult = (event: any) => {
        this.zone.run(() => {
          const transcript = event.results[event.results.length - 1][0].transcript.trim();
          if (transcript) {
            this.handleUserMessage(transcript);
          }
        });
      };

    } catch(e) {
      this.error.set("Speech Recognition could not be initialized.");
      console.error(e);
    }
  }

  toggleListening() {
    if (!this.recognition) return;

    if (this.isListening()) {
      this.recognition.stop();
    } else {
      if (this.isProcessing() || this.synth.speaking) return;
      this.recognition.start();
    }
  }
  
  private async handleUserMessage(text: string) {
    this.isProcessing.set(true);
    this.messages.update(current => [...current, { sender: 'user', text }]);
    this.messages.update(current => [...current, { sender: 'ai', text: '', isStreaming: true }]);

    const stream = await this.geminiService.sendMessage(text);
    if (!stream) {
      this.isProcessing.set(false);
      this.messages.update(current => {
        const last = current[current.length-1];
        if(last.sender === 'ai' && last.isStreaming) {
           last.text = "Sorry, I couldn't process that. Please try again.";
           last.isStreaming = false;
        }
        return [...current];
      });
      return;
    }
    
    let aiResponse = '';
    try {
        for await (const chunk of stream) {
            const chunkText = chunk.text;
            aiResponse += chunkText;
            this.messages.update(current => {
              const last = current[current.length - 1];
              if (last.sender === 'ai' && last.isStreaming) {
                last.text = aiResponse;
              }
              return [...current];
            });
        }
    } catch(e) {
        console.error("Error processing stream:", e);
        this.error.set("An error occurred while receiving the response.");
        aiResponse = "I encountered an error. Please try again."
    } finally {
        this.messages.update(current => {
            const last = current[current.length - 1];
            if (last.sender === 'ai') {
                last.isStreaming = false;
                // FIX: Provide a fallback message for better UX if the AI response is empty.
                if (!aiResponse) {
                  aiResponse = "I'm sorry, I didn't catch that. Could you please say it again?";
                }
                last.text = aiResponse;
            }
            return [...current];
        });

        this.isProcessing.set(false);
        this.speak(aiResponse);
    }
  }

  speak(text: string) {
    if (this.synth.speaking) {
      this.synth.cancel();
    }
    if (text !== '') {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = this.voices.find(v => v.name === 'Google US English') || this.voices[0];
      utterance.pitch = 1;
      utterance.rate = 1.05;
      utterance.volume = 1;
      this.synth.speak(utterance);
    }
  }

  formatMessage(text: string): string {
    return text.replace(/\n/g, '<br>');
  }

  ngOnDestroy() {
    if (this.recognition) {
      this.recognition.abort();
    }
    if (this.synth) {
      this.synth.cancel();
    }
  }
  
  private scrollToBottom(): void {
    setTimeout(() => {
      try {
        if (this.chatContainer?.nativeElement) {
          this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
        }
      } catch (err) {
        console.error('Could not scroll to bottom:', err);
      }
    }, 0);
  }
}
