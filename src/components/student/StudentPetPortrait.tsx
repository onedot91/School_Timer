import { getStudentPetKind, type StudentPetKind } from '../../lib/studentPet';
import { getPetPortrait } from '../../lib/petSprites';

interface StudentPetPortraitProps {
  kind: StudentPetKind | null;
  className?: string;
}

/** Still picture of the pet when its art exists; emoji for kinds not drawn yet. */
export default function StudentPetPortrait({ kind, className }: StudentPetPortraitProps) {
  const portraitUrl = getPetPortrait(kind);
  const classes = ['student-pet-portrait', portraitUrl ? 'has-sprite' : '', className ?? ''].filter(Boolean).join(' ');
  return portraitUrl ? (
    <img className={classes} src={portraitUrl} alt="" aria-hidden="true" draggable={false} decoding="async" />
  ) : (
    <span className={classes} aria-hidden="true">{getStudentPetKind(kind).emoji}</span>
  );
}
