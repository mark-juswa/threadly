import { useEffect, useRef, useState, forwardRef } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { uploadService } from '../../api/uploadService';
import { useSocket } from '../../context/SocketContext';
import { v4 as uuidv4 } from 'uuid';
import imageCompression from 'browser-image-compression';

const RichTextEditor = forwardRef((props, ref) => {
  const editorRef = useRef(null);
  const { currentNote, updateNote } = useNotes();
  const { socket, connected } = useSocket();
  
  // Track the current note ID to detect actual note changes
  const currentNoteIdRef = useRef(null);
  const isAutoSavingRef = useRef(false);
  const sessionIdRef = useRef(uuidv4()); // Unique session ID for this tab
  const currentVersionRef = useRef(null); // Track current version for conflict detection
  const isSyncingFromSocketRef = useRef(false); // Prevent echo when receiving socket updates

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
  const [uploadingImages, setUploadingImages] = useState(new Map()); // Track uploading images
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
      currentVersionRef.current = currentNote?.version || 0;
      
      // Leave previous note room and join new note room
      if (socket && connected) {
        if (previousNoteId) {
          socket.emit('leave-note', previousNoteId);
        }
        if (noteId) {
          socket.emit('join-note', noteId);
        }
      }
      
      if (editorRef.current && currentNote) {
        editorRef.current.innerHTML = currentNote.content || '';
      } else if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
    }
  }, [currentNote?._id, currentNote?.content, socket, connected]);

  // Socket listener for real-time sync from other sessions
  useEffect(() => {
    if (!socket || !connected) return;

    const handleNoteSync = (data) => {
      const { noteId, content, version, sessionId } = data;
      
      // Ignore updates from this session (our own changes)
      if (sessionId === sessionIdRef.current) return;
      
      // Only sync if we're viewing this note
      if (noteId !== currentNote?._id) return;
      
      // Save cursor position
      const selection = window.getSelection();
      let cursorOffset = 0;
      let cursorNode = null;
      
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        cursorNode = range.startContainer;
        cursorOffset = range.startOffset;
      }
      
      // Update content from other session
      isSyncingFromSocketRef.current = true;
      if (editorRef.current) {
        editorRef.current.innerHTML = content;
      }
      currentVersionRef.current = version;
      
      // Restore cursor position (best effort)
      try {
        if (cursorNode && editorRef.current.contains(cursorNode)) {
          const newRange = document.createRange();
          const newSelection = window.getSelection();
          newRange.setStart(cursorNode, Math.min(cursorOffset, cursorNode.length));
          newRange.collapse(true);
          newSelection.removeAllRanges();
          newSelection.addRange(newRange);
        }
      } catch (e) {
        // Cursor restoration failed, that's okay
      }
      
      isSyncingFromSocketRef.current = false;
    };

    socket.on('note-sync', handleNoteSync);

    return () => {
      socket.off('note-sync', handleNoteSync);
    };
  }, [socket, connected, currentNote?._id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Leave note room on unmount
      if (socket && currentNoteIdRef.current) {
        socket.emit('leave-note', currentNoteIdRef.current);
      }
    };
  }, [socket]);

  // Auto-save on content change (debounced)
  const handleContentChange = () => {
    if (!currentNote || isSyncingFromSocketRef.current) return;

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
      
      // Include version and sessionId for conflict detection
      const result = await updateNote(currentNote._id, { 
        content,
        version: currentVersionRef.current,
        sessionId: sessionIdRef.current
      }, { skipRefresh: true });
      
      // Handle version conflict
      if (result?.success === false && result?.conflict) {
        console.warn('Version conflict detected:', result);
        // For now, accept the server version (last-write-wins)
        // In future, could show a merge UI
        if (editorRef.current && result.currentContent) {
          editorRef.current.innerHTML = result.currentContent;
          currentVersionRef.current = result.currentVersion;
        }
      } else if (result?.note) {
        // Update version after successful save
        currentVersionRef.current = result.note.version;
      }
      
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
  const handleInput = (e) => {
    // Check for markdown shortcuts after input
    const selection = window.getSelection();
    if (!selection.rangeCount) {
      handleContentChange();
      return;
    }
    
    const focusNode = selection.focusNode;
    if (focusNode.nodeType !== 3) {
      handleContentChange();
      return;
    }

    const text = focusNode.textContent;
    const patterns = [
      { match: /^#\s$/, format: 'h1', removeChars: 2 },
      { match: /^##\s$/, format: 'h2', removeChars: 3 },
      { match: /^###\s$/, format: 'h3', removeChars: 4 },
      { match: /^-\s$/, format: 'insertUnorderedList', removeChars: 2 },
      { match: /^\*\s$/, format: 'insertUnorderedList', removeChars: 2 },
      { match: /^1\.\s$/, format: 'insertOrderedList', removeChars: 3 },
      { match: /^>\s$/, format: 'formatBlock', param: 'blockquote', removeChars: 2 },
      { match: /^```\s$/, format: 'formatBlock', param: 'pre', removeChars: 4 }
    ];

    for (let p of patterns) {
      const normalizedText = text.replace(/\u00A0/g, ' ');
      if (p.match.test(normalizedText)) {
        e.preventDefault();
        
        // Remove the markdown characters
        const range = document.createRange();
        range.setStart(focusNode, 0);
        range.setEnd(focusNode, p.removeChars);
        range.deleteContents();
        
        // Apply the formatting
        if (p.format === 'formatBlock') {
          document.execCommand(p.format, false, p.param);
        } else {
          document.execCommand(p.format, false, null);
        }
        
        handleContentChange();
        return;
      }
    }

    // Clean up ghost list markers - remove empty lists
    if (editorRef.current) {
      const emptyLists = editorRef.current.querySelectorAll('ul:empty, ol:empty');
      emptyLists.forEach(list => list.remove());
    }

    handleContentChange();
  };

  // Shared image upload handler with compression and optimistic UI
  const uploadImage = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;

    try {
      const tempId = `temp-${uuidv4()}`;
      
      // Compress image before upload (especially important for Render free tier)
      const options = {
        maxSizeMB: 1, // Max 1MB
        maxWidthOrHeight: 1920, // Max dimension
        useWebWorker: true,
        fileType: file.type
      };
      
      const compressedBlob = await imageCompression(file, options);
      
      // Create a new File object with proper name and type
      // This ensures multer's fileFilter recognizes it correctly
      // Handle clipboard images which may not have a name
      const getFileExtension = (mimeType) => {
        const map = {
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/png': 'png',
          'image/gif': 'gif',
          'image/webp': 'webp'
        };
        return map[mimeType] || 'png';
      };
      
      const fileName = file.name || `clipboard-${Date.now()}.${getFileExtension(file.type)}`;
      const compressedFile = new File(
        [compressedBlob], 
        fileName,
        { 
          type: file.type || 'image/png',
          lastModified: Date.now()
        }
      );
      
      console.log(`Image compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
      
      // Create blob URL for preview
      const blobUrl = URL.createObjectURL(compressedFile);
      
      // Create optimistic placeholder with loading state
      const placeholderDiv = document.createElement('div');
      placeholderDiv.id = tempId;
      placeholderDiv.className = 'relative inline-block my-4';
      placeholderDiv.innerHTML = `
        <img src="${blobUrl}" class="max-w-[80%] max-h-[400px] object-contain rounded-lg shadow-lg block opacity-50 blur-sm" />
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="bg-gray-800/90 text-gray-200 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Uploading...
          </div>
        </div>
      `;
      
      // Insert placeholder at cursor position
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(placeholderDiv);
        
        // Move cursor after the placeholder
        range.setStartAfter(placeholderDiv);
        range.setEndAfter(placeholderDiv);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        // Fallback: append to editor
        editorRef.current?.appendChild(placeholderDiv);
      }
      
      // Track upload (before triggering content change to prevent race conditions)
      setUploadingImages(prev => new Map(prev).set(tempId, true));
      
      // Trigger save with the placeholder (but this shouldn't interfere with replacement)
      handleContentChange();
      
      // Upload to backend
      console.log('Starting upload to backend...');
      const result = await uploadService.uploadImage(compressedFile);
      console.log('Upload result:', result);
      
      const imageUrl = uploadService.getImageUrl(result.imageUrl);
      console.log('Image URL:', imageUrl);
      
      // Remove from tracking IMMEDIATELY (before DOM manipulation)
      setUploadingImages(prev => {
        const next = new Map(prev);
        next.delete(tempId);
        return next;
      });
      
      // Replace placeholder with real image
      const placeholder = document.getElementById(tempId);
      console.log('Placeholder found:', placeholder);
      console.log('Placeholder parent:', placeholder?.parentElement);
      console.log('Is in editor:', placeholder ? editorRef.current?.contains(placeholder) : false);
      
      if (placeholder && editorRef.current?.contains(placeholder)) {
        // Revoke blob URL to free memory
        const oldImg = placeholder.querySelector('img');
        if (oldImg && oldImg.src.startsWith('blob:')) {
          URL.revokeObjectURL(oldImg.src);
        }
        
        // Create new image element (more reliable than outerHTML)
        const newImg = document.createElement('img');
        newImg.src = imageUrl;
        newImg.onclick = () => window.expandImage(newImg);
        newImg.className = 'max-w-[80%] max-h-[400px] object-contain rounded-lg my-4 shadow-lg block cursor-zoom-in hover:opacity-90 transition';
        
        // Replace placeholder with new image
        placeholder.replaceWith(newImg);
        console.log('Placeholder replaced with real image using replaceWith()');
        
        // Small delay before triggering save to ensure DOM is updated
        setTimeout(() => {
          handleContentChange();
        }, 100);
      } else {
        console.warn('❌ Placeholder not found or not in editor');
        console.warn('Editor current:', editorRef.current);
        console.warn('Temp ID:', tempId);
        console.warn('All elements with temp ID:', document.querySelectorAll(`[id^="temp-"]`));
      }
      
      console.log('Upload complete!');
      
    } catch (error) {
      console.error('Failed to upload image:', error);
      console.error('Error details:', error.response?.data || error.message);
      
      // Remove placeholder on error
      const placeholder = document.getElementById(tempId);
      if (placeholder) {
        // Revoke blob URL to free memory
        const oldImg = placeholder.querySelector('img');
        if (oldImg && oldImg.src.startsWith('blob:')) {
          URL.revokeObjectURL(oldImg.src);
        }
        placeholder.remove();
      }
      
      // Remove from tracking
      setUploadingImages(prev => {
        const next = new Map(prev);
        next.delete(tempId);
        return next;
      });
      
      alert(`Failed to upload image: ${error.response?.data?.message || error.message}`);
    }
  };

  // Drag and drop image upload
  const handleDrop = async (e) => {
    e.preventDefault();
    editorRef.current.classList.remove('bg-gray-900/50');

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadImage(e.dataTransfer.files[0]);
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

  // Handle paste to support both text and images
  const handlePaste = async (e) => {
    e.preventDefault();
    
    // Check for image in clipboard first
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    
    if (imageItem) {
      // Handle image paste (from Snipping Tool, screenshots, etc.)
      const file = imageItem.getAsFile();
      if (file) {
        await uploadImage(file);
      }
      return;
    }
    
    // Check for image files
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        await uploadImage(file);
        return;
      }
    }
    
    // Otherwise, handle text paste (strip formatting)
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
        onInput={handleInput}
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