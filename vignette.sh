#!/usr/bin/env bash
# ------------------------------------------------------------------------------------------------------------
# vignette.sh : crée UNE vignette (image WebP légère) à partir d'un instant précis d'une vidéo.
#
# UTILISATION :
#     bash vignette.sh "<vidéo>" "<instant>" "<nom de l'image>"
#
#   <vidéo>           l'adresse de la vidéo sur Bunny (https://...) OU un fichier sur ton ordinateur
#   <instant>         le moment de la vidéo dont tu veux faire la vignette :
#                       12.5        = 12,5 secondes
#                       1:05        = 1 minute 5 secondes
#                       0:01:05.5   = 1 minute 5,5 secondes
#   <nom de l'image>  le nom du fichier à créer, de préférence sans espace ni accent (".webp" ajouté tout seul)
#
# EXEMPLES :
#     bash vignette.sh "https://MaptDiff.b-cdn.net/Vid%C3%A9os%20Format%20Insta%20Verti/Etretat-SiteWeb%20MPEG-4.mp4" 12.5 etretat
#     bash vignette.sh "/Users/moi/Movies/etretat.mp4" 0:12.5 etretat.webp
#
# RÉSULTAT : le fichier img/<nom>.webp, à mettre dans le dossier /img de ton site (GitHub).
# Il faut ffmpeg avec WebP (sur Mac : brew install ffmpeg). Pour une adresse https, ffmpeg ne lit que le début
# de la vidéo jusqu'à l'instant demandé.
#
# RÉGLAGES (facultatif, devant la commande) : par exemple   COTE_MAX=700 bash vignette.sh ...
#   COTE_MAX  longueur maximale du plus grand côté de l'image, en pixels (jamais agrandie). Défaut : 900
#   QUALITE   qualité WebP de 0 à 100. Défaut : 78
#   SORTIE    dossier où écrire l'image. Défaut : img
#   REFERER   adresse de ton site (la protection anti-hotlinking de Bunny la vérifie)
# ------------------------------------------------------------------------------------------------------------
set -u

COTE_MAX="${COTE_MAX:-900}"
QUALITE="${QUALITE:-78}"
SORTIE="${SORTIE:-img}"
REFERER="${REFERER:-https://lamachineaprendreletemps.pixelsenscene.fr/}"

usage() {
    echo "Utilisation :  bash vignette.sh \"<vidéo : adresse https://... ou fichier>\" \"<instant>\" \"<nom de l'image>\""
    echo "Exemple     :  bash vignette.sh \"https://MaptDiff.b-cdn.net/.../ma-video.mp4\" 12.5 ma-vignette"
    echo "(l'instant s'écrit 12.5, 1:05 ou 0:01:05.5)"
}

[ "$#" -eq 3 ] || { usage; exit 2; }
VIDEO="$1"
INSTANT="$2"
NOM="$3"

command -v ffmpeg >/dev/null 2>&1 || { echo "ffmpeg est introuvable (sur Mac : brew install ffmpeg)."; exit 1; }
ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libwebp || { echo "Ce ffmpeg ne sait pas écrire du WebP (libwebp)."; exit 1; }

# instant : secondes (12.5), m:s (1:05) ou h:m:s (0:01:05.5)
if ! [[ "$INSTANT" =~ ^[0-9]+(\.[0-9]+)?$ || "$INSTANT" =~ ^([0-9]+:){1,2}[0-9]+(\.[0-9]+)?$ ]]; then
    echo "L'instant \"$INSTANT\" n'est pas valable. Écris-le comme 12.5, 1:05 ou 0:01:05.5"
    exit 2
fi

# nom : on enlève un éventuel dossier, et on ajoute .webp si besoin
NOM="${NOM##*/}"
case "$NOM" in
    *.webp|*.WEBP) ;;
    *) NOM="$NOM.webp" ;;
esac
if [[ "$NOM" =~ [^A-Za-z0-9._-] ]]; then
    echo "Attention : le nom \"$NOM\" contient des espaces ou des accents ; c'est possible, mais un nom simple (lettres, chiffres, tirets) évite les ennuis dans les adresses."
fi

mkdir -p "$SORTIE" || exit 1
SORTIE_FICHIER="$SORTIE/$NOM"

# Pour une adresse https, on s'identifie auprès de Bunny avec l'adresse du site (anti-hotlinking)
ENTETE=()
case "$VIDEO" in
    http://*|https://*) ENTETE=(-headers "Referer: ${REFERER}"$'\r\n') ;;
    *) [ -f "$VIDEO" ] || { echo "Fichier introuvable : $VIDEO"; exit 1; } ;;
esac

rm -f "$SORTIE_FICHIER"
# -ss avant -i : on saute directement à l'instant voulu sans lire toute la vidéo
# scale : le plus grand côté est ramené à COTE_MAX (jamais agrandi), l'autre suit
ffmpeg -hide_banner -loglevel error -y \
    ${ENTETE[@]+"${ENTETE[@]}"} \
    -ss "$INSTANT" -i "$VIDEO" \
    -frames:v 1 \
    -vf "scale=w='if(gte(iw,ih),min(${COTE_MAX},iw),-2)':h='if(gte(iw,ih),-2,min(${COTE_MAX},ih))'" \
    -c:v libwebp -quality "$QUALITE" \
    "$SORTIE_FICHIER" 2>/tmp/vignette_erreur.txt

# ffmpeg peut "réussir" en écrivant une image VIDE (instant après la fin de la vidéo) : on vérifie qu'il y a vraiment une image
TAILLE=0
[ -f "$SORTIE_FICHIER" ] && TAILLE=$(wc -c < "$SORTIE_FICHIER" | tr -d ' ')
DIMS=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$SORTIE_FICHIER" 2>/dev/null)
if [ "$TAILLE" -lt 500 ] || [ -z "$DIMS" ] || [ "$DIMS" = "0x0" ]; then
    echo "Échec : aucune image créée."
    sed -n '1,3p' /tmp/vignette_erreur.txt
    echo "Causes possibles : l'instant $INSTANT est après la fin de la vidéo, l'adresse est fausse, ou Bunny refuse l'accès (vérifie REFERER)."
    rm -f "$SORTIE_FICHIER"
    exit 1
fi

echo "OK : $SORTIE_FICHIER   ($DIMS, $((TAILLE / 1024)) Ko)"
echo "Mets ce fichier dans le dossier /img de ton site ; dans la page, son adresse sera :  img/$NOM"