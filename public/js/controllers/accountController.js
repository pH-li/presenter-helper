import { href, navigate } from '../router.js';
import { toast } from '../views/ui.js';

export class AccountController {
  /**
   * @param {import('../services/accountState.js').Account} account
   * @param {import('../views/accountView.js').AccountView} view
   */
  constructor(account, view) {
    this.account = account;
    this.view = view;
  }

  mount() {
    const { auth, sync } = this.account;
    let ui = { sentTo: '', busy: false, error: '' };
    const render = () => this.view.render({ ...this.account.state(), ...ui });
    const set = (patch) => {
      ui = { ...ui, ...patch };
      render();
    };

    this.view.bind({
      onSendLink: async (email) => {
        if (!/^\S+@\S+\.\S+$/.test(email)) return set({ error: 'Enter a valid email address.' });
        set({ busy: true, error: '' });
        try {
          await auth.sendMagicLink(email);
          set({ busy: false, sentTo: email });
        } catch (e) {
          set({ busy: false, error: friendlyError(e) });
        }
      },
      onReset: () => set({ sentTo: '', error: '' }),
      onSyncNow: async () => {
        set({ busy: true, error: '' });
        await sync.pull({ force: true });
        set({ busy: false, error: sync.status === 'synced' ? '' : 'Couldn’t reach the server. We’ll keep retrying.' });
      },
      onSignOut: async () => {
        set({ busy: true, error: '' });
        if (!(await sync.flush())) {
          return set({ busy: false, error: 'Some changes haven’t synced yet. Connect to the internet and try again so nothing is lost.' });
        }
        const userId = auth.user && auth.user.id;
        try {
          await auth.signOut();
          if (userId) sync.forgetUser(userId);
          toast('Signed out.');
          navigate(href.home());
        } catch (e) {
          set({ busy: false, error: friendlyError(e) });
        }
      },
    });

    render();
    const offAuth = auth ? auth.onChange(() => set({ sentTo: '' })) : () => {};
    const offSync = sync ? sync.onStatus(render) : () => {};
    return () => {
      offAuth();
      offSync();
    };
  }
}

function friendlyError(e) {
  const msg = (e && e.message) || '';
  if (/rate limit|too many/i.test(msg)) return 'Too many sign-in emails were requested. Wait a few minutes and try again.';
  if (/fetch|network|load/i.test(msg)) return 'Couldn’t reach the server. Check your connection and try again.';
  return msg || 'Something went wrong. Please try again.';
}
