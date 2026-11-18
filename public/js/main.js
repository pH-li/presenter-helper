// Composition root: build the models, services, views and controllers, then start routing.
import { config } from './config.js';
import { LocalStore, userStorageKey } from './models/localStore.js';
import { PresentationsModel } from './models/presentationsModel.js';
import { HomeView } from './views/homeView.js';
import { EditView } from './views/editView.js';
import { PresentView } from './views/presentView.js';
import { AccountView } from './views/accountView.js';
import { toast } from './views/ui.js';
import { HomeController } from './controllers/homeController.js';
import { EditController } from './controllers/editController.js';
import { PresentController } from './controllers/presentController.js';
import { AccountController } from './controllers/accountController.js';
import { AuthService } from './services/auth.js';
import { CloudSync } from './services/cloudSync.js';
import { getSupabase } from './services/supabaseClient.js';
import { createAccount } from './services/accountState.js';
import { PrefsStore } from './models/prefsStore.js';
import { Router } from './router.js';
import { plural } from './utils.js';

// Show the last signed-in user's cached data immediately (works offline too);
// auth confirms or corrects this a moment later.
const lastUser = config.cloudEnabled ? CloudSync.lastUserId() : null;
const store = lastUser ? new LocalStore(undefined, userStorageKey(lastUser)) : new LocalStore();
const model = new PresentationsModel(store, { onSaveError: toast });

const auth = config.cloudEnabled ? new AuthService() : null;
const sync = auth ? new CloudSync(model, getSupabase) : null;
const account = createAccount(auth, sync);

const root = document.getElementById('app');
const home = new HomeController(model, new HomeView(root), account);
const edit = new EditController(model, new EditView(root));
const present = new PresentController(model, new PresentView(root), new PrefsStore());
const accountPage = new AccountController(account, new AccountView(root));

const router = new Router(
  {
    '': () => home.mount(),
    edit: (id) => edit.mount(id),
    present: (id) => present.mount(id),
    account: () => accountPage.mount(),
  },
  () => home.mount()
);
router.start();

if (auth) {
  // Re-render after a user switch, but never interrupt a running presentation.
  const refresh = () => {
    if (router.current !== 'present') router.resolve();
  };

  let knownUser = lastUser;
  auth.onChange(async (user) => {
    if (user) {
      const fresh = user.id !== knownUser;
      knownUser = user.id;
      const adopted = await sync.start(user);
      if (adopted) toast(`Signed in. Added ${plural(adopted, 'presentation')} from this device to your account.`);
      else if (fresh) toast('Signed in. Your presentations now sync across devices.');
    } else {
      knownUser = null;
      sync.stop();
    }
    refresh();
  });

  auth
    .init()
    .then(({ linkError }) => {
      if (linkError) toast(`Sign-in link problem: ${linkError}`);
      if (!auth.user && lastUser) {
        sync.stop(); // session ended elsewhere; keep the cached copy until they sign back in
        refresh();
      } else if (!auth.user) {
        refresh(); // update "Connecting…" → sign-in form
      }
    })
    .catch((e) => {
      console.warn('Cloud sync unavailable', e);
      refresh();
    });
}
