
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ChatComponent } from './components/chat/chat.component';

@Component({
  selector: 'app-root',
  // FIX: Use an inline template for this simple component and add OnPush change detection for performance.
  template: `<app-chat></app-chat>`,
  imports: [ChatComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
