import { splitNotes, slidesTotalSeconds } from '../models/presentation.js';
import { parseDuration } from '../utils.js';
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
    const updateSummary = () => view.setTimingSummary(slidesTotalSeconds(p), p.targetMinutes);
    const renderSlides = (focusIndex) => {
      view.renderSlides(p, focusIndex);
      updateSummary();
    };

    view.bind({
      onTitle: (title) => {
        model.update(id, { title });
        view.setTitle(title);
      },
      onTargetMinutes: (value) => {
        model.update(id, { targetMinutes: value });
        updateSummary();
      },
      onNotes: (index, notes) => model.setSlideNotes(id, index, notes),
      // Returns the parsed seconds (saved), or null if the text isn't a time yet (not saved).
      onSlideTarget: (index, text) => {
        const seconds = parseDuration(text);
        if (seconds === null) return null;
        model.setSlideTarget(id, index, seconds);
        updateSummary();
        return seconds;
      },
      onAddSlide: () => renderSlides(model.addSlide(id)),
      onMoveSlide: (index, delta) => {
        if (model.moveSlide(id, index, delta)) renderSlides();
      },
      onRemoveSlide: (index) => {
        if (model.removeSlide(id, index)) renderSlides();
      },
      // Returns true when the paste was handled (so the view cancels the default).
      onPaste: (index, { text, before, after }) => {
        const parts = splitNotes(text);
        if (!parts) return false;
        model.setSlideNotes(id, index, before + parts[0] + after);
        model.insertSlidesAfter(id, index, parts.slice(1));
        renderSlides(index + parts.length - 1);
        toast(`Split into ${parts.length} slides.`);
        return true;
      },
    });
    view.render(p);
    updateSummary();
  }
}
