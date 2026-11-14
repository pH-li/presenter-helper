// Composition root: build the model, views and controllers, then start routing.
import { LocalStore } from './models/localStore.js';
import { PresentationsModel } from './models/presentationsModel.js';
import { HomeView } from './views/homeView.js';
import { EditView } from './views/editView.js';
import { PresentView } from './views/presentView.js';
import { toast } from './views/ui.js';
import { HomeController } from './controllers/homeController.js';
import { EditController } from './controllers/editController.js';
import { PresentController } from './controllers/presentController.js';
import { Router } from './router.js';

const root = document.getElementById('app');
const model = new PresentationsModel(new LocalStore(), { onSaveError: toast });

const home = new HomeController(model, new HomeView(root));
const edit = new EditController(model, new EditView(root));
const present = new PresentController(model, new PresentView(root));

new Router(
  {
    '': () => home.mount(),
    edit: (id) => edit.mount(id),
    present: (id) => present.mount(id),
  },
  () => home.mount()
).start();
