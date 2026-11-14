import { href, navigate } from '../router.js';
import { toast, downloadFile } from '../views/ui.js';
import { plural } from '../utils.js';

export class HomeController {
  /**
   * @param {import('../models/presentationsModel.js').PresentationsModel} model
   * @param {import('../views/homeView.js').HomeView} view
   * @param {import('../services/accountState.js').Account} account
   */
  constructor(model, view, account) {
    this.model = model;
    this.view = view;
    this.account = account;
  }

  /** @returns {() => void} cleanup */
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

    const { sync } = this.account;
    const offStatus = sync ? sync.onStatus(() => this.view.setAccount(this.account.state())) : () => {};
    const offRemote = sync ? sync.onRemoteChange(() => this.render()) : () => {};
    return () => {
      offStatus();
      offRemote();
    };
  }

  render() {
    const state = this.account.state();
    this.view.render(this.model.list(), state);
    this.view.setAccount(state);
  }
}
