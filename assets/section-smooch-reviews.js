/* Smooch reviews — topic filter.
   Progressive enhancement: without this file every review card simply shows.
   <smooch-review-filter> wraps the chip row and the card masonry; pressing a
   chip toggles [hidden] on cards whose data-topic doesn't match the chip's
   data-filter (case-insensitive). Chips are real <button>s with aria-pressed.
   Guarded so theme-editor section reloads never double-define. */

if (!customElements.get('smooch-review-filter')) {
  customElements.define(
    'smooch-review-filter',
    class SmoochReviewFilter extends HTMLElement {
      connectedCallback() {
        this.onClick = (event) => {
          const chip = event.target.closest('button[data-filter]');
          if (!chip || !this.contains(chip)) return;
          this.applyFilter(chip.getAttribute('data-filter') || '');
        };
        this.addEventListener('click', this.onClick);
      }

      disconnectedCallback() {
        this.removeEventListener('click', this.onClick);
      }

      applyFilter(rawTopic) {
        const topic = rawTopic.trim().toLowerCase();

        this.querySelectorAll('button[data-filter]').forEach((chip) => {
          const value = (chip.getAttribute('data-filter') || '').trim().toLowerCase();
          chip.setAttribute('aria-pressed', value === topic ? 'true' : 'false');
        });

        let visibleCount = 0;
        this.querySelectorAll('[data-topic]').forEach((card) => {
          const cardTopic = (card.getAttribute('data-topic') || '').trim().toLowerCase();
          const matches = topic === '' || cardTopic === topic;
          card.toggleAttribute('hidden', !matches);
          if (matches) visibleCount += 1;
        });

        const emptyNote = this.querySelector('[data-empty-note]');
        if (emptyNote) emptyNote.toggleAttribute('hidden', visibleCount > 0);
      }
    }
  );
}
