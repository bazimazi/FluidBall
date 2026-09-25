import './ui/styles.css';
import { Game } from './game/game';
import { CAMPAIGN } from './levels/campaign';
import { LAB } from './levels/lab';
import { Ui } from './ui/ui';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = new Ui(document.getElementById('ui')!);
const game = new Game(canvas, ui);
ui.attach(game);

// Audio can only start from a user gesture.
const unlock = () => game.audio.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

// Dev tooling: ?level=<id> jumps straight into a level, and the game is inspectable from the console.
if (import.meta.env.DEV) {
  const id = new URLSearchParams(location.search).get('level');
  const level = [...CAMPAIGN, LAB].find((l) => l.id === id);
  if (level) game.startLevel(level);
  (window as unknown as { fluid: Game }).fluid = game;
}
