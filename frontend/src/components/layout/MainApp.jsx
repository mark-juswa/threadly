import { useState, useEffect, useRef } from 'react';
import TopicSidebar from './TopicSidebar';
import CategorySidebar from './CategorySidebar';
import Header from './Header';
import RichTextEditor from '../editor/RichTextEditor';
import FloatingToolbar from '../editor/FloatingToolbar';
import EditorOutlineSidebar from '../editor/EditorOutlineSidebar';
import ImageModal from '../modals/ImageModal';
import ModalOverlay from '../modals/ModalOverlay';
import NoteModal from '../modals/NoteModal';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useNotes } from '../../hooks/useNotes';

const MainApp = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const editorRef = useRef(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalType, setCreateModalType] = useState('topic');
  const [createModalData, setCreateModalData] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu();
  const { fetchAllNotes } = useNotes();

  const handleCreateTopic = () => {
    setCreateModalType('topic');
    setCreateModalData(null);
    setShowCreateModal(true);
  };

  const handleCreateCategory = () => {
    setCreateModalType('category');
    setCreateModalData(null);
    setShowCreateModal(true);
  };

  const handleCreateNote = (categoryId, groupId = null) => {
    setCreateModalType('note');
    setCreateModalData({ categoryId, groupId });
    setShowCreateModal(true);
  };

  const handleCreateGroup = (categoryId) => {
    setCreateModalType('group');
    setCreateModalData({ categoryId });
    setShowCreateModal(true);
  };

  const handleCreateSubgroup = (parentGroup) => {
    setCreateModalType('subgroup');
    setCreateModalData({ 
      categoryId: parentGroup.categoryId, 
      parentGroupId: parentGroup._id 
    });
    setShowCreateModal(true);
  };

  const handleCreateOrphanNote = () => {
    setCreateModalType('note');
    setCreateModalData({ categoryId: null }); // No category = orphan note
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateModalData(null);
  };

  // Edit handlers
  const handleEditCategory = (category) => {
    setEditModal({ type: 'category', data: category });
  };

  const handleEditGroup = (group) => {
    setEditModal({ type: 'group', data: group });
  };

  const handleEditNote = (note) => {
    setEditModal({ type: 'note', data: note });
  };

  const handleEditTopic = (topic) => {
    setEditModal({ type: 'topic', data: topic });
  };

  const closeEditModal = () => {
    setEditModal(null);
  };

  // Delete handlers
  const handleDeleteTopic = (topic) => {
    setDeleteModal({ type: 'topic', data: topic });
  };

  const handleDeleteCategory = (category) => {
    setDeleteModal({ type: 'category', data: category });
  };

  const handleDeleteGroup = (group) => {
    setDeleteModal({ type: 'group', data: group });
  };

  const handleDeleteNote = (note) => {
    setDeleteModal({ type: 'note', data: note });
  };

  const closeDeleteModal = () => {
    setDeleteModal(null);
  };

  // Fetch notes when app loads (user is authenticated at this point)
  useEffect(() => {
    fetchAllNotes();
  }, [fetchAllNotes]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const toggleRightSidebar = () => {
    setIsRightSidebarOpen(prev => !prev);
  };

  const closeRightSidebar = () => {
    setIsRightSidebarOpen(false);
  };

  const handleGlobalClick = () => {
    hideContextMenu();
  };

  useEffect(() => {
    const shouldLockScroll = isMobileMenuOpen || isRightSidebarOpen;
    document.body.style.overflow = shouldLockScroll ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen, isRightSidebarOpen]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsRightSidebarOpen(false);
      }
    };

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
        setIsRightSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return (
    <div 
      className="relative flex h-full text-white bg-black selection:bg-green-500/30 selection:text-white"
      onClick={handleGlobalClick}
    >
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 transition-opacity bg-black/80 md:hidden backdrop-blur-sm"
          onClick={toggleMobileMenu}
        />
      )}

      {/* Sidebar Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-40 flex h-full transform md:translate-x-0 md:relative transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <TopicSidebar showContextMenu={showContextMenu} onCreateTopic={handleCreateTopic} />
        <CategorySidebar 
          showContextMenu={showContextMenu}
          toggleMobileMenu={toggleMobileMenu}
          onCreateTopic={handleCreateTopic}
          onCreateCategory={handleCreateCategory}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 bg-[#151515] flex flex-col relative min-w-0">
        <Header toggleMobileMenu={toggleMobileMenu} toggleRightSidebar={toggleRightSidebar} />
        
        <div className="relative flex-1 flex overflow-hidden">
          {/* Editor Area */}
          <div className="flex-1 relative overflow-hidden">
            <RichTextEditor ref={editorRef} />
          </div>
          {/* Right Sidebar Mobile Backdrop */}
          {isRightSidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
              onClick={closeRightSidebar}
            />
          )}
          
          
          {/* Right Contextual Sidebar - Page Outline */}
          <EditorOutlineSidebar
            editorRef={editorRef}
            isMobileOpen={isRightSidebarOpen}
            onMobileClose={closeRightSidebar}
          />
        </div>

        <FloatingToolbar />
      </main>

      {/* Image Modal */}
      <ImageModal />

      {/* Modal Overlay (for create/edit/delete modals) */}
      <ModalOverlay 
        contextMenu={contextMenu}
        hideContextMenu={hideContextMenu}
        onCreateNote={handleCreateNote}
        onCreateGroup={handleCreateGroup}
        onCreateSubgroup={handleCreateSubgroup}
        onCreateCategory={handleCreateCategory}
        onCreateTopic={handleCreateTopic}
        onCreateOrphanNote={handleCreateOrphanNote}
        editModal={editModal}
        onEditCategory={handleEditCategory}
        onEditGroup={handleEditGroup}
        onEditNote={handleEditNote}
        onEditTopic={handleEditTopic}
        onCloseEditModal={closeEditModal}
        deleteModal={deleteModal}
        onDeleteTopic={handleDeleteTopic}
        onDeleteCategory={handleDeleteCategory}
        onDeleteGroup={handleDeleteGroup}
        onDeleteNote={handleDeleteNote}
        onCloseDeleteModal={closeDeleteModal}
      />

      {/* Create Topic/Category/Note/Group Modal */}
      {showCreateModal && (
        <NoteModal
          type={createModalType}
          data={createModalData}
          onClose={closeCreateModal}
        />
      )}
    </div>
  );
};

export default MainApp;

