
import { Injectable, signal } from '@angular/core';
import { GoogleGenAI, Chat } from '@google/genai';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private genAI: GoogleGenAI;
  private chat!: Chat;
  public error = signal<string | null>(null);

  constructor() {
    if (!process.env.API_KEY) {
        const errorMessage = 'API key for Google GenAI is not set. Please set the API_KEY environment variable.';
        this.error.set(errorMessage);
        console.error(errorMessage);
        // Using a dummy key to avoid crashing the app if the key is not set.
        // The service will show an error in the UI.
        this.genAI = new GoogleGenAI({ apiKey: 'MISSING_API_KEY' });
        return;
    }
    this.genAI = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    this.startChat();
  }

  startChat() {
    this.chat = this.genAI.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `You are a friendly and patient language learning partner for practicing English. Your name is Alex. 
        Keep your responses concise and natural, like in a real conversation.
        Encourage the user to speak. If the user makes a grammatical mistake, gently correct it and explain briefly why, then continue the conversation.
        For example, if the user says 'I goed to the store', you could say 'That's great! Just a small correction, we say 'I went to the store'. What did you buy there?'`,
      },
    });
  }

  async sendMessage(message: string) {
    this.error.set(null);
    if (!this.chat) {
      if(!this.error()){
        this.startChat();
      } else {
        return null;
      }
    }
    try {
      const result = await this.chat.sendMessageStream({ message });
      return result;
    } catch (e) {
      const errorMessage = 'Failed to send message to Gemini. Please check your API key and network connection.';
      console.error(errorMessage, e);
      this.error.set(errorMessage);
      return null;
    }
  }
}
