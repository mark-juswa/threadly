import SearchBar from '../editor/SearchBar';
import { useNotes } from '../../hooks/useNotes';

const Header = ({ toggleMobileMenu, toggleRightSidebar }) => {
  const { currentTopic, currentCategory, currentNote } = useNotes();

  return (
    <header className="h-20 flex items-center justify-between gap-3 px-4 md:px-8 border-b border-gray-800/50 bg-[#151515] z-20">
      <div className="flex min-w-0 items-center gap-4">
        {/* Mobile Menu Button */}
        <button
          onClick={toggleMobileMenu}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-gray-400 md:hidden hover:bg-gray-800/60 hover:text-white"
          aria-label="Open navigation sidebar"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Breadcrumb */}
        <div className="min-w-0">
          <h2 className="hidden mb-1 text-xs font-bold tracking-widest text-gray-400 uppercase sm:block">
            {currentTopic?.name || 'Workspace'}
          </h2>
          <div className="flex min-w-0 items-center space-x-2 text-sm text-gray-500">
            <span className="hidden text-gray-600 sm:inline">
              {currentCategory?.name || 'Category'}
            </span>
            <span className="hidden sm:inline">/</span>
            <span className="truncate font-medium text-white">
              {currentNote?.title || 'Select a note'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <SearchBar />
        <button
          onClick={toggleRightSidebar}
          disabled={!currentNote}
          className="flex h-10 w-10 items-center justify-center rounded-md text-gray-400 md:hidden hover:bg-gray-800/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Open outline and AI review sidebar"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5h10M4 12h16M4 19h10" />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default Header;
