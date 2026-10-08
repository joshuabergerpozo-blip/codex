// Tracé du circuit (en mètres, plan XZ). Sens de course = ordre des points.
// Le premier segment est la ligne droite des stands avec la grille de départ.
const RAW_POINTS = [
  [-380, 0],
  [-200, 0],
  [0, 0],
  [200, 0],
  [360, 0],
  // Virage 1 : grand droite en épingle
  [450, 15],
  [500, 70],
  [490, 140],
  [430, 175],
  // Enchaînement des « S »
  [350, 170],
  [280, 185],
  [235, 235],
  [240, 300],
  // Courbe rapide vers l'arrière du circuit
  [290, 360],
  [380, 390],
  [520, 400],
  [640, 420],
  // Épingle
  [710, 470],
  [715, 545],
  [660, 590],
  [580, 585],
  // Ligne droite opposée
  [450, 560],
  [300, 545],
  [170, 545],
  // Chicane
  [100, 560],
  [50, 600],
  [-20, 610],
  [-80, 580],
  // Grande courbe rapide à gauche puis retour
  [-180, 540],
  [-300, 540],
  [-420, 500],
  [-500, 420],
  [-530, 300],
  [-520, 170],
  [-480, 60],
];
export const TRACK_SCALE = 0.6;
export const TRACK_POINTS = RAW_POINTS.map(([x, z]) => [
  x * TRACK_SCALE,
  z * TRACK_SCALE,
]);
export const TRACK_WIDTH = 14;
