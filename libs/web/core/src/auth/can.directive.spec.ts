import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AuthService } from './auth.service';
import { CanDirective } from './can.directive';
import { signal } from '@angular/core';

@Component({
  selector: 'sk-test-can',
  imports: [CanDirective],
  template: `<b *skCan="['asset', 'delete']">delete</b><i *skCan="['asset', 'read']">read</i>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {}

describe('skCan', () => {
  it('renders only what the permissions allow and follows changes', async () => {
    const permissions = signal(['asset:read']);
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { permissions } }],
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('b')).toBeNull();
    expect(el.querySelector('i')).not.toBeNull();
    permissions.set(['asset:delete']);
    await fixture.whenStable();
    expect(el.querySelector('b')).not.toBeNull();
    expect(el.querySelector('i')).toBeNull();
  });
});
