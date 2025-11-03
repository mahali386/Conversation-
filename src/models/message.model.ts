
export interface Message {
  sender: 'user' | 'ai';
  text: string;
  isStreaming?: boolean;
}
