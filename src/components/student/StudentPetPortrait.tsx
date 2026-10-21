import { getStudentPetKind, type StudentPetKind } from '../../lib/studentPet';
import { PET_SPRITE_BACKGROUND_SIZE, getPetSpriteSheet } from '../../lib/petSprites';

interface StudentPetPortraitProps {
  kind: StudentPetKind | null;
  className?: string;
}

/** Still sprite of the pet when its art exists; emoji for kinds not drawn yet. */
export default function StudentPetPortrait({ kind, className }: StudentPetPortraitProps) {
  const sheetUrl = getPetSpriteSheet(kind);
  const classes = ['student-pet-portrait', sheetUrl ? 'has-sprite' : '', className ?? ''].filter(Boolean).join(' ');
  return sheetUrl ? (
    <span className={classes} style={{ backgroundImage: `url(${sheetUrl})`, backgroundSize: PET_SPRITE_BACKGROUND_SIZE }} aria-hidden="true" />
  ) : (
    <span className={classes} aria-hidden="true">{getStudentPetKind(kind).emoji}</span>
  );
}
