import CategoryContextMenu from '../contextMenus/CategoryContextMenu';
import TopicContextMenu from '../contextMenus/TopicContextMenu';
import SubtopicContextMenu from '../contextMenus/SubtopicContextMenu';
import GeneralContextMenu from '../contextMenus/GeneralContextMenu';
import GroupContextMenu from '../contextMenus/GroupContextMenu';
import EditModal from './EditModal';
import NoteModal from './NoteModal';
import DeleteModal from './DeleteModal';

const ModalOverlay = ({ 
  contextMenu, 
  hideContextMenu, 
  onCreateNote, 
  onCreateGroup, 
  onCreateSubgroup,
  onCreateCategory, 
  onCreateTopic, 
  onCreateOrphanNote,
  editModal,
  onEditCategory,
  onEditGroup,
  onEditNote,
  onEditTopic,
  onCloseEditModal,
  deleteModal,
  onDeleteTopic,
  onDeleteCategory,
  onDeleteGroup,
  onDeleteNote,
  onCloseDeleteModal
}) => {
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      hideContextMenu();
    }
  };

  // Don't return null if editModal or deleteModal is open - we need to render it!
  if (!contextMenu.visible && !editModal && !deleteModal) return null;

  return (
    <>
      {/* Context Menus - only render when context menu is visible */}
      {contextMenu.visible && (
        <>
          {contextMenu.type === 'category' && (
            <CategoryContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              data={contextMenu.data}
              onClose={hideContextMenu}
              onCreateNote={onCreateNote}
              onCreateGroup={onCreateGroup}
              onEdit={onEditCategory}
              onDelete={onDeleteCategory}
            />
          )}
          
          {contextMenu.type === 'topic' && (
            <TopicContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              data={contextMenu.data}
              onClose={hideContextMenu}
              onEdit={onEditTopic}
              onDelete={onDeleteTopic}
            />
          )}
          
          {contextMenu.type === 'subtopic' && (
            <SubtopicContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              data={contextMenu.data}
              onClose={hideContextMenu}
              onEdit={onEditNote}
              onDelete={onDeleteNote}
            />
          )}

          {contextMenu.type === 'group' && (
            <GroupContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              data={contextMenu.data}
              onClose={hideContextMenu}
              onCreateNote={onCreateNote}
              onCreateSubgroup={onCreateSubgroup}
              onEdit={onEditGroup}
              onDelete={onDeleteGroup}
            />
          )}
          
          {contextMenu.type === 'general' && (
            <GeneralContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={hideContextMenu}
              onCreateCategory={onCreateCategory}
              onCreateTopic={onCreateTopic}
              onCreateOrphanNote={onCreateOrphanNote}
            />
          )}

          {contextMenu.type === 'addSubtopic' && (
            <CategoryContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              data={contextMenu.data}
              onClose={hideContextMenu}
              onCreateNote={onCreateNote}
              onCreateGroup={onCreateGroup}
              onEdit={onEditCategory}
              showAddSubtopic={true}
            />
          )}
        </>
      )}

      {/* Edit Modal - renders independently of context menu */}
      {editModal && editModal.type === 'topic' && (
        <NoteModal
          type="topic"
          mode="edit"
          data={editModal.data}
          onClose={onCloseEditModal}
        />
      )}
      {editModal && editModal.type !== 'topic' && (
        <EditModal
          type={editModal.type}
          data={editModal.data}
          onClose={onCloseEditModal}
        />
      )}

      {/* Delete Modal - renders independently of context menu */}
      {deleteModal && (
        <DeleteModal
          type={deleteModal.type}
          data={deleteModal.data}
          onClose={onCloseDeleteModal}
        />
      )}
    </>
  );
};

export default ModalOverlay;