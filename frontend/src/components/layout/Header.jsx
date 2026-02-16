    import SearchBar from '../editor/SearchBar';
import { useNotes } from '../../hooks/useNotes';

const Header = ({ toggleMobileMenu }) => {
  const { currentTopic, currentCategory, currentNote } = useNotes();

  return (
    <header className="h-20 flex items-center justify-between px-4 md:px-8 border-b border-gray-800/50 bg-[#151515] z-20">
      <div className="flex items-center gap-4">
        {/* Mobile Menu Button */}
        <button
          onClick={toggleMobileMenu}
          className="p-1 text-gray-400 md:hidden hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Breadcrumb */}
        <div>
          <h2 className="hidden mb-1 text-xs font-bold tracking-widest text-gray-400 uppercase sm:block">
            {currentTopic?.name || 'Workspace'}
          </h2>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span className="text-gray-600">
              {currentCategory?.name || 'Category'}
            </span>
            <span>/</span>
            <span className="font-medium text-white">
              {currentNote?.title || 'Select a note'}
            </span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar />
    </header>
  );
};

export default Header;