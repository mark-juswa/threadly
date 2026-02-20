import { useEffect, useRef, useState, forwardRef } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { uploadService } from '../../api/uploadService';

const RichTextEditor = forwardRef((props, ref) => {
  const editorRef = useRef(null);
  const { currentNote, updateNote } = useNotes();
  
  // Track the current note ID to detect actual note changes
  const currentNoteIdRef = useRef(null);
  const isAutoSavingRef = useRef(false);

  // Sync the forwarded ref with our internal ref
  useEffect(() => {
    if (ref) {
      if (typeof ref === 'function') {
        ref(editorRef.current);
      } else {
        ref.current = editorRef.current;
      }
    }
  }, [ref, currentNote?._id]); // Only re-sync when note ID changes
  
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef(null);

  // Load current note content - ONLY when note ID changes
  useEffect(() => {
    const noteId = currentNote?._id || null;
    const previousNoteId = currentNoteIdRef.current;
    
    // Only update content if the note ID actually changed
    if (noteId !== previousNoteId) {
      // Clear any pending auto-save for the previous note
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      
      currentNoteIdRef.current = noteId;
      
      if (editorRef.current && currentNote) {
        editorRef.current.innerHTML = currentNote.content || '';
      } else if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
    }
  }, [currentNote?._id, currentNote?.content]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Auto-save on content change (debounced)
  const handleContentChange = () => {
    if (!currentNote) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(async () => {
      const content = editorRef.current?.innerHTML;
      if (!content && content !== '') return; // Safety check
      
      isAutoSavingRef.current = true;
      setIsSaving(true);
      
      // Use skipRefresh to prevent re-renders and cursor reset
      await updateNote(currentNote._id, { content }, { skipRefresh: true });
      
      setIsSaving(false);
      isAutoSavingRef.current = false;
    }, 1000); // Save after 1 second of no typing
  };

  // Helper function to find the parent list item (li) or checklist item
  const findListItem = (node) => {
    let current = node;
    while (current && current !== editorRef.current) {
      if (current.nodeName === 'LI') return { type: 'list', element: current };
      if (current.classList?.contains('checklist-item')) return { type: 'checklist', element: current };
      current = current.parentNode;
    }
    return null;
  };

  // Helper function to get the text content of a list item
  const getListItemText = (listItem) => {
    if (listItem.type === 'checklist') {
      const textSpan = listItem.element.querySelector('.checklist-text');
      return textSpan ? textSpan.textContent.trim() : '';
    }
    return listItem.element.textContent.trim();
  };

  // Helper function to check if cursor is at the start of an element
  const isCursorAtStart = () => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return false;
    const range = selection.getRangeAt(0);
    return range.startOffset === 0 && range.collapsed;
  };

  // Helper function to convert list item to paragraph
  const convertToParagraph = (listItem) => {
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    
    if (listItem.type === 'checklist') {
      listItem.element.insertAdjacentElement('afterend', p);
      listItem.element.remove();
    } else {
      // For ul/ol list items
      const parentList = listItem.element.parentNode;
      const siblings = Array.from(parentList.children);
      const itemIndex = siblings.indexOf(listItem.element);
      
      if (siblings.length === 1) {
        // Only one item in list - replace entire list with paragraph
        parentList.insertAdjacentElement('afterend', p);
        parentList.remove();
      } else if (itemIndex === 0) {
        // First item - insert paragraph before list and remove item
        parentList.insertAdjacentElement('beforebegin', p);
        listItem.element.remove();
      } else {
        // Middle or last item - insert paragraph after current item and remove item
        listItem.element.insertAdjacentElement('afterend', p);
        listItem.element.remove();
        
        // If the list is now empty, remove it
        if (parentList.children.length === 0) {
          parentList.remove();
        }
      }
    }
    
    // Focus on the new paragraph
    const range = document.createRange();
    const selection = window.getSelection();
    range.setStart(p, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  // Toggle highlight function for keyboard shortcut
  const toggleHighlight = () => {
    // Ensure styleWithCSS is enabled
    document.execCommand('styleWithCSS', false, true);
    
    const bgColor = document.queryCommandValue('backColor');
    
    if (bgColor === 'rgb(250, 204, 21)' || bgColor === '#facc15') {
      document.execCommand('hiliteColor', false, 'transparent');
      document.execCommand('foreColor', false, '#d1d5db');
    } else {
      document.execCommand('hiliteColor', false, '#facc15');
      document.execCommand('foreColor', false, 'black');
    }
  };

  // Apply formatting command with proper selection handling
  const applyFormat = (cmd, value = null) => {
    // Ensure styleWithCSS is enabled for consistent behavior
    document.execCommand('styleWithCSS', false, true);
    // Execute the formatting command
    document.execCommand(cmd, false, value);
  };

  // Handle keydown for list behaviors (Enter and Backspace) and formatting shortcuts
  const handleKeyDown = (e) => {
    // Handle formatting keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U)
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          applyFormat('bold');
          return;
        case 'i':
          e.preventDefault();
          applyFormat('italic');
          return;
        case 'u':
          e.preventDefault();
          applyFormat('underline');
          return;
      }
    }

    // Handle Alt+H for highlight toggle
    if (e.altKey && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      toggleHighlight();
      return;
    }

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const listItem = findListItem(selection.focusNode);
    if (!listItem) return;

    const itemText = getListItemText(listItem);
    const isAtStart = isCursorAtStart();

    // Handle Enter key - create new item or exit list mode
    if (e.key === 'Enter') {
      // Skip for checklist - it has its own handler
      if (listItem.type === 'checklist') return;

      // If current list item is empty, exit list mode
      if (itemText === '') {
        e.preventDefault();
        convertToParagraph(listItem);
        handleContentChange();
        return;
      }
      // Otherwise, let default behavior create new list item
    }

    // Handle Backspace key
    if (e.key === 'Backspace') {
      // Skip for checklist - it has its own handler
      if (listItem.type === 'checklist') return;

      // If item is empty OR cursor is at start with text, convert to paragraph
      if (itemText === '' || (isAtStart && itemText.length > 0)) {
        if (itemText === '') {
          e.preventDefault();
          convertToParagraph(listItem);
          handleContentChange();
        } else if (isAtStart) {
          // Cursor at start with text - convert but preserve text
          e.preventDefault();
          const p = document.createElement('p');
          p.innerHTML = listItem.element.innerHTML;
          
          const parentList = listItem.element.parentNode;
          const siblings = Array.from(parentList.children);
          
          if (siblings.length === 1) {
            parentList.insertAdjacentElement('afterend', p);
            parentList.remove();
          } else {
            listItem.element.insertAdjacentElement('afterend', p);
            listItem.element.remove();
            if (parentList.children.length === 0) {
              parentList.remove();
            }
          }
          
          // Focus at start of the new paragraph
          const range = document.createRange();
          const sel = window.getSelection();
          range.setStart(p, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          handleContentChange();
        }
      }
      // Otherwise, let default backspace behavior delete characters
    }
  };

  // Markdown-like shortcuts
  const handleKeyUp = (e) => {
    if (e.key === ' ') {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      
      const focusNode = selection.focusNode;
      if (focusNode.nodeType !== 3) return; // Text nodes only

      const text = focusNode.textContent;
      const patterns = [
        { match: /^#\s$/, format: 'h1' },
        { match: /^##\s$/, format: 'h2' },
        { match: /^###\s$/, format: 'h3' },
        { match: /^-\s$/, format: 'insertUnorderedList' },
        { match: /^\*\s$/, format: 'insertUnorderedList' },
        { match: /^1\.\s$/, format: 'insertOrderedList' },
        { match: /^>\s$/, format: 'formatBlock', param: 'blockquote' },
        { match: /^```\s$/, format: 'formatBlock', param: 'pre' }
      ];

      for (let p of patterns) {
        const normalizedText = text.replace(/\u00A0/g, ' ');
        if (p.match.test(normalizedText)) {
          document.execCommand('delete', false, null);
          if (p.format === 'formatBlock') {
            document.execCommand(p.format, false, p.param);
          } else {
            document.execCommand(p.format, false, null);
          }
          e.preventDefault();
          break;
        }
      }
    }

    // Clean up ghost list markers - remove empty lists
    if (editorRef.current) {
      const emptyLists = editorRef.current.querySelectorAll('ul:empty, ol:empty');
      emptyLists.forEach(list => list.remove());
    }

    handleContentChange();
  };

  // Drag and drop image upload
  const handleDrop = async (e) => {
    e.preventDefault();
    editorRef.current.classList.remove('bg-gray-900/50');

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      
      if (file.type.startsWith('image/')) {
        try {
          // Upload to backend
          const result = await uploadService.uploadImage(file);
          const imageUrl = uploadService.getImageUrl(result.imageUrl);

          // Insert image into editor
          const imgHtml = `<img src="${imageUrl}" onclick="window.expandImage(this)" class="max-w-[80%] max-h-[400px] object-contain rounded-lg my-4 shadow-lg block cursor-zoom-in hover:opacity-90 transition" /><br>`;
          document.execCommand('insertHTML', false, imgHtml);

          handleContentChange();
        } catch (error) {
          console.error('Failed to upload image:', error);
          alert('Failed to upload image');
        }
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    editorRef.current.classList.add('bg-gray-900/50');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    editorRef.current.classList.remove('bg-gray-900/50');
  };

  // Handle paste to strip external formatting
  const handlePaste = (e) => {
    e.preventDefault();
    
    // Get plain text from clipboard
    const text = e.clipboardData.getData('text/plain');
    
    if (text) {
      // Insert plain text at cursor position
      document.execCommand('insertText', false, text);
      handleContentChange();
    }
  };

  return (
    <>
      <div
        ref={editorRef}
        id="editor"
        contentEditable={!!currentNote}
        className="w-full h-full overflow-y-auto bg-transparent focus:outline-none text-gray-300 p-8 text-md font-light leading-relaxed empty:before:content-[attr(placeholder)] empty:before:text-gray-600"
        placeholder={currentNote ? "Type '# ' for Heading, '- ' for list, or select text to format..." : "Select a note to start editing"}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onInput={handleContentChange}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        suppressContentEditableWarning
      />
      
      {/* Saving Indicator */}
      {isSaving && (
        <div className="absolute bottom-4 right-4 bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full shadow-lg">
          Saving...
        </div>
      )}
    </>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;