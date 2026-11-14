import { href, navigate } from '../router.js';
import { toast, downloadFile } from '../views/ui.js';
import { plural } from '../utils.js';

export class HomeController {
  /**
   * @param {import('../models/presentationsModel.js').PresentationsModel} model
   * @param {import('../views/homeView.js').HomeView} view
   */
  constructor(model, view) {
    this.model = model;
    this.view = view;
  }

  mount() {
    this.view.bind({
      onCreate: () => navigate(href.edit(this.model.create().id)),
      onDelete: (id) => {
        this.model.remove(id);
        this.render();
      },
      onExport: () => {
        const date = new Date().toISOString().slice(0, 10);
        downloadFile(`presenter-helper-backup-${date}.json`, this.model.toJSON());
      },
      onImport: async (file) => {
        try {
          const count = this.model.importData(JSON.parse(await file.text()));
          this.render();
          toast(`Imported ${plural(count, 'presentation')}.`);
        } catch {
          toast("That file doesn't look like a Presenter Helper backup.");
        }
      },
    });
    this.render();
  }

  render() {
    this.view.render(this.model.list());
  }
}
