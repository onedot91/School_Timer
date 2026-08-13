import { ShoppingBag } from 'lucide-react';
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
      icon={ShoppingBag}
      title="고마 쓰기"
      onClick={onOpen}
    />
  );
}
