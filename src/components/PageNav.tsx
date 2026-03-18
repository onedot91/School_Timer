import { Hash, Timer } from 'lucide-react';

type AppRoute = '/' | '/draw';

const NAV_ITEMS = [
  { path: '/' as const, label: '타이머', Icon: Timer },
  { path: '/draw' as const, label: '랜덤 번호', Icon: Hash },
];

export default function PageNav({ currentPath }: { currentPath: AppRoute }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-3 sm:top-4 sm:px-4">
      <nav className="page-floating-nav pointer-events-auto flex items-center gap-2 rounded-full p-1.5">
        {NAV_ITEMS.map(({ path, label, Icon }) => {
          const isActive = currentPath === path;

          return (
            <a
              key={path}
              href={`#${path}`}
              aria-current={isActive ? 'page' : undefined}
              className={`page-nav-link inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all sm:px-5 sm:text-base ${
                isActive
                  ? 'page-nav-link-active text-[#2F5B43]'
                  : 'text-[#6D5645] hover:text-[#2F5B43]'
              }`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
