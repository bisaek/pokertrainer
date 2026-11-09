const RANKS = "23456789TJQKA";
const SUITS = "CDHS";

// Kept so the browser holds on to the decoded images.
let images: HTMLImageElement[] | undefined;

// Fetches and decodes every card face (and the back) up front, so a card
// shows the moment it is dealt instead of after its SVG loads.
export function preloadCards() {
  if (images) return;
  const names = [...RANKS].flatMap((rank) => [...SUITS].map((suit) => rank + suit));
  images = [...names, "2B"].map((name) => {
    const image = new Image();
    image.src = `/poker-cards/${name}.svg`;
    image.decode().catch(() => {});
    return image;
  });
}
