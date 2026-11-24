import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '@swarm-keeper/web-core';

/** `/` until the real home exists: names the signed-in family. Sign-out is in the header. */
@Component({
  selector: 'sk-home-placeholder-page',
  imports: [TranslocoPipe],
  templateUrl: './home-placeholder.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePlaceholderPage {
  protected readonly auth = inject(AuthService);
}
