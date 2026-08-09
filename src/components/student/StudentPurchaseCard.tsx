import { Gavel } from 'lucide-react';
import StudentSectionCard from './StudentSectionCard';

interface StudentPurchaseCardProps {
  onOpen: () => void;
}

export default function StudentPurchaseCard({
  onOpen,
}: StudentPurchaseCardProps) {
  return (
    <StudentSectionCard
      tone="store"
      icon={Gavel}
      title="경매와 기부"
      actionLabel="고마 사용하기"
      onClick={onOpen}
    />
  );
}
