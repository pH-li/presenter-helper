import { splitNotes } from '../models/presentation.js';
import { toast } from '../views/ui.js';

export class EditController {
  /**
   * @param {import('../models/presentationsModel.js').PresentationsModel} model
   * @param {import('../views/editView.js').EditView} view
   */
  constructor(model, view) {
    this.model = model;
    this.view = view;
  }

  /** @returns {false | void} false if the presentation doesn't exist */
  mount(id) {
    const p = this.model.get(id);
    if (!p) return false;
    const { model, view } = this;

    view.bind({
      onTitle: (title) => {
        model.update(id, { title });
        view.setTitle(title);
      },
      onTargetMinutes: (value) => model.update(id, { targetMinutes: value }),
      onNotes: (index, notes) => model.setSlideNotes(id, index, notes),
      onAddSlide: () => view.renderSlides(p, model.addSlide(id)),
      onMoveSlide: (index, delta) => {
        if (model.moveSlide(id, index, delta)) view.renderSlides(p);
      },
      onRemoveSlide: (index) => {
        if (model.removeSlide(id, index)) view.renderSlides(p);
      },
      // Returns true when the paste was handled (so the view cancels the default).
      onPaste: (index, { text, before, after }) => {
        const parts = splitNotes(text);
        if (!parts) return false;
        model.setSlideNotes(id, index, before + parts[0] + after);
        model.insertSlidesAfter(id, index, parts.slice(1));
        view.renderSlides(p, index + parts.length - 1);
        toast(`Split into ${parts.length} slides.`);
        return true;
      },
    });
    view.render(p);
  }
}
