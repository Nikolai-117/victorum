/**
 * Téléversement d'images depuis le navigateur.
 *
 * On réduit l'image avant de l'envoyer : une photo de téléphone de plusieurs
 * mégaoctets devient un WebP de quelques dizaines de kilooctets, sans que le
 * serveur ait à retoucher quoi que ce soit. Ce qui part est déjà léger, ce qui
 * revient (`/img/<id>`) est mis en cache pour toujours.
 */

/** Redessine l'image dans un canevas au plus grand côté borné, en WebP. */
export async function reduireImage(fichier, cotéMax = 1600, qualite = 0.85) {
  if (!fichier || !fichier.type || !fichier.type.startsWith('image/')) {
    throw new Error("Ce fichier n'est pas une image.");
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(fichier);
  } catch {
    return fichier; // navigateur trop ancien : on envoie l'original.
  }
  const echelle = Math.min(1, cotéMax / Math.max(bitmap.width, bitmap.height));
  const largeur = Math.max(1, Math.round(bitmap.width * echelle));
  const hauteur = Math.max(1, Math.round(bitmap.height * echelle));

  const canevas = document.createElement('canvas');
  canevas.width = largeur;
  canevas.height = hauteur;
  canevas.getContext('2d').drawImage(bitmap, 0, 0, largeur, hauteur);

  const blob = await new Promise((resoudre) => canevas.toBlob(resoudre, 'image/webp', qualite));
  return blob && blob.size < fichier.size ? blob : fichier;
}

/**
 * Réduit puis téléverse une image ; renvoie son URL (`/img/<id>`).
 * Lève une erreur portant `code = 401` si le mot de passe est refusé.
 */
export async function televerserImage(fichier, motDePasse) {
  const reduit = await reduireImage(fichier);
  const corps = new FormData();
  corps.append('image', reduit, 'image.webp');

  const reponse = await fetch('/api/images', {
    method: 'POST',
    headers: { 'x-mot-de-passe': motDePasse },
    body: corps,
  });
  const res = await reponse.json().catch(() => ({}));
  if (reponse.status === 401) {
    const err = new Error(res.erreur || 'Mot de passe refusé.');
    err.code = 401;
    throw err;
  }
  if (!reponse.ok) throw new Error(res.erreur || 'Échec du téléversement.');
  return res.url;
}

/**
 * Branche un bouton « Téléverser » sur un champ texte : au choix d'un fichier,
 * l'image part, et son URL remplit le champ. `motDePasse` fournit le secret ;
 * `etat` (facultatif) reçoit les messages.
 */
export function brancherTeleversement({ champ, motDePasse, etat, surErreur }) {
  const fichier = document.createElement('input');
  fichier.type = 'file';
  fichier.accept = 'image/*';
  fichier.hidden = true;

  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'bouton bouton--televerser';
  bouton.textContent = 'Téléverser une image';
  bouton.addEventListener('click', () => fichier.click());

  fichier.addEventListener('change', async () => {
    const f = fichier.files && fichier.files[0];
    if (!f) return;
    const mdp = motDePasse();
    if (!mdp) return;
    if (etat) etat.textContent = 'Téléversement…';
    bouton.disabled = true;
    try {
      const url = await televerserImage(f, mdp);
      champ.value = url;
      champ.dispatchEvent(new Event('change', { bubbles: true }));
      if (etat) etat.textContent = 'Image téléversée.';
    } catch (e) {
      if (e.code === 401) sessionStorage.removeItem('victorum:mot-de-passe');
      if (etat) etat.textContent = e.message;
      if (surErreur) surErreur(e);
    } finally {
      bouton.disabled = false;
      fichier.value = '';
    }
  });

  // Le bouton se pose juste après le champ ; l'input caché l'accompagne.
  champ.insertAdjacentElement('afterend', bouton);
  bouton.insertAdjacentElement('afterend', fichier);
  return bouton;
}
