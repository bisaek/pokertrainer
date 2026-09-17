const STORAGE_KEY = "pokertrainer.show-table.v1";

// Whether the trainers show the spot as a table. Shared so the toggle, the table
// and the layout around them agree, and remembered across pages.
class TableView {
  shown = $state(false);
  private loaded = false;

  load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      this.shown = localStorage.getItem(STORAGE_KEY) === "1";
    } catch (error) {
      console.error(error);
    }
  }

  toggle() {
    this.shown = !this.shown;
    try {
      localStorage.setItem(STORAGE_KEY, this.shown ? "1" : "0");
    } catch (error) {
      console.error(error);
    }
  }
}

export const tableView = new TableView();
