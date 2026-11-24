import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppearanceService, AuthService } from '@swarm-keeper/web-core';
import { AuthCard } from '../ui';

/** `/` until the real home exists: shows the signed-in family and a way out. */
@Component({
  selector: 'sk-home-placeholder-page',
  imports: [AuthCard, MatButtonModule, TranslocoPipe],
  templateUrl: './home-placeholder.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePlaceholderPage {
  protected readonly auth = inject(AuthService);
  protected readonly appearance = inject(AppearanceService);
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
