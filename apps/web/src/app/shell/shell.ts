import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService, CanDirective } from '@swarm-keeper/web-core';

/** Every signed-in screen: the header with the user menu, the page below. */
@Component({
  selector: 'sk-shell',
  imports: [
    CanDirective,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    RouterLink,
    RouterOutlet,
    TranslocoPipe,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly initial = computed(() =>
    (this.auth.user()?.name || this.auth.user()?.email || '').charAt(0).toUpperCase(),
  );

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
