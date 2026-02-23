import { useEffect, useRef, forwardRef, memo } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { uploadService } from '../../api/uploadService';
import { useSocket } from '../../context/SocketContext';
import { v4 as uuidv4 } from 'uuid';
import imageCompression from 'browser-image-compression';

const RichTextEditor = forwardRef((props, ref) => {
  const editorRef = useRef(null);
  const { currentNote, updateNote } = useNotes();

  // socketRef and connectedRef are passed as props from the RichTextEditorWrapper below.
  // This means RichTextEditor itself does NOT call useSocket() and does NOT subscribe
  // to SocketContext — so socket reconnects never cause this component to re-render.
  const { socketRef, connectedRef } = props;
  
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
  
  // Use a ref instead of state for tracking in-flight image uploads.
  // State would trigger re-renders on every upload start/finish, which disturbs the cursor.
  const uploadingImagesRef = useRef(new Map());
  const saveTimeoutRef = useRef(null);
  const savingIndicatorRef = useRef(null); // Ref to the saving indicator DOM node (avoids re-render)

  // Load current note content - ONLY when the note ID changes.
  // socket and connected are intentionally excluded from the dependency array:
  // including them would cause this effect to re-fire on every socket reconnect
  // (common on Render's free tier), which would reset innerHTML and jump the cursor.
  // Socket room join/leave is handled by a separate dedicated effect below.
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
      
      if (editorRef.current && currentNote) {
        editorRef.current.innerHTML = currentNote.content || '';
      } else if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNote?._id]); // ← ONLY the note ID. socket/connected are handled separately.

  // Manage socket room membership. Uses socketRef/connectedRef so this effect
  // does NOT re-run (and thus does NOT cause a re-render) on socket reconnects.
  // Instead it runs only when the note ID changes (user switches notes).
  useEffect(() => {
    const noteId = currentNoteIdRef.current;
    const s = socketRef.current;
    if (!s || !connectedRef.current || !noteId) return;
    s.emit('join-note', noteId);
    return () => {
      s.emit('leave-note', noteId);
    };
  }, [currentNote?._id]); // only when note changes, NOT on socket reconnect

  // Socket listener for real-time sync from other sessions.
  // Registered once on mount using the socket ref — no re-registration on reconnect.
  useEffect(() => {
    const handleNoteSync = (data) => {
      const { noteId, content, version, sessionId } = data;
      if (sessionId === sessionIdRef.current) return; // ignore own echo
      if (noteId !== currentNoteIdRef.current) return; // ignore other notes

      // Save cursor position before replacing innerHTML
      const selection = window.getSelection();
      let savedRange = null;
      if (selection.rangeCount > 0) {
        savedRange = selection.getRangeAt(0).cloneRange();
      }

      isSyncingFromSocketRef.current = true;
      if (editorRef.current) {
        editorRef.current.innerHTML = content;
      }
      currentVersionRef.current = version;

      // Restore cursor (best effort — node refs may have changed after innerHTML replace)
      try {
        if (savedRange && editorRef.current) {
          const newSelection = window.getSelection();
          newSelection.removeAllRanges();
          newSelection.addRange(savedRange);
        }
      } catch (e) { /* ignore — cursor restore after remote sync is best-effort */ }

      isSyncingFromSocketRef.current = false;
    };

    // Attach listener via the socket ref. When the socket reconnects, the ref
    // is updated by the useEffect above — but we do NOT re-register the listener
    // here, which avoids the re-render that was resetting the cursor.
    // Instead, we use a stable wrapper that always reads socketRef.current.
    const attachListener = () => {
      if (socketRef.current) {
        socketRef.current.off('note-sync', handleNoteSync);
        socketRef.current.on('note-sync', handleNoteSync);
      }
    };

    attachListener();

    return () => {
      if (socketRef.current) {
        socketRef.current.off('note-sync', handleNoteSync);
      }
    };
  }, []); // mount/unmount only — socket reconnects do NOT cause re-render

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (socketRef.current && currentNoteIdRef.current) {
        socketRef.current.emit('leave-note', currentNoteIdRef.current);
      }
    };
  }, []); // mount/unmount only

  // Show/hide the saving indicator by directly mutating the DOM node.
  // This deliberately avoids calling setIsSaving (React state) so that NO re-render
  // is triggered during auto-save — which is the root cause of the cursor jump.
  const showSavingIndicator = () => {
    if (savingIndicatorRef.current) {
      savingIndicatorRef.current.style.display = 'flex';
    }
  };

  const hideSavingIndicator = () => {
    if (savingIndicatorRef.current) {
      savingIndicatorRef.current.style.display = 'none';
    }
  };

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
      if (content === undefined || content === null) return; // Safety check

      isAutoSavingRef.current = true;
      showSavingIndicator(); // Direct DOM mutation — no React re-render

      // IMPORTANT: Do NOT capture/restore the cursor here.
      // The user keeps typing DURING the async HTTP request (which can take 500ms–2s on
      // Render's free tier). If we save the cursor position before the await and restore
      // it after, we actively move the cursor BACKWARD to where it was when the save
      // started — which is exactly the bug. The browser naturally keeps the cursor in
      // the right place as long as we do not touch the DOM or call setState.

      // Snapshot the note ID so we can guard against note-switching mid-save
      const savingNoteId = currentNote._id;

      // Include version and sessionId for conflict detection
      const result = await updateNote(savingNoteId, {
        content,
        version: currentVersionRef.current,
        sessionId: sessionIdRef.current
      }, { skipRefresh: true });

      // If user switched notes while save was in-flight, do nothing to the DOM
      if (currentNoteIdRef.current !== savingNoteId) {
        hideSavingIndicator();
        isAutoSavingRef.current = false;
        return;
      }

      // Handle version conflict — only case where we must touch the DOM
      if (result?.conflict) {
        if (editorRef.current && result.currentContent) {
          editorRef.current.innerHTML = result.currentContent;
          currentVersionRef.current = result.currentVersion;
          // Cursor is inherently lost here because we replaced content with the server
          // version. Move cursor to end as a reasonable fallback.
          try {
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(editorRef.current);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          } catch (e) { /* ignore */ }
        }
      } else if (result?.note) {
        // Successful save — just update the tracked version number.
        // Do NOT touch the selection/cursor at all. The browser has kept
        // it exactly where the user left it.
        currentVersionRef.current = result.note.version;
      }

      hideSavingIndicator(); // Direct DOM mutation — no React re-render
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
      
      // Create optimistic placeholder (no loading state, just the image)
      const placeholderDiv = document.createElement('div');
      placeholderDiv.id = tempId;
      placeholderDiv.className = 'inline-block my-4';
      placeholderDiv.innerHTML = `
        <img src="${blobUrl}" class="max-w-[80%] max-h-[400px] object-contain rounded-lg shadow-lg block" />
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
      
      // Track upload (ref-based — no React re-render)
      uploadingImagesRef.current.set(tempId, true);
      
      // Trigger save with the placeholder (but this shouldn't interfere with replacement)
      handleContentChange();
      
      // Upload to backend
      console.log('Starting upload to backend...');
      const result = await uploadService.uploadImage(compressedFile);
      console.log('Upload result:', result);
      
      const imageUrl = uploadService.getImageUrl(result.imageUrl);
      console.log('Image URL:', imageUrl);
      
      // Remove from tracking IMMEDIATELY (before DOM manipulation — ref, no re-render)
      uploadingImagesRef.current.delete(tempId);
      
      // Replace placeholder with real image
      const placeholder = document.getElementById(tempId);
      console.log('Placeholder found:', placeholder);
      console.log('Placeholder parent:', placeholder?.parentElement);
      console.log('Is in editor:', placeholder ? editorRef.current?.contains(placeholder) : false);
      
      if (placeholder && editorRef.current?.contains(placeholder)) {
        // Create new image element (more reliable than outerHTML)
        const newImg = document.createElement('img');
        newImg.src = imageUrl;
        newImg.onclick = () => window.expandImage(newImg);
        newImg.className = 'max-w-[80%] max-h-[400px] object-contain rounded-lg my-4 shadow-lg block cursor-zoom-in hover:opacity-90 transition';
        
        // Replace placeholder with new image
        placeholder.replaceWith(newImg);
        console.log('Placeholder replaced with real image using replaceWith()');
        
        // Revoke blob URL AFTER replacement to prevent WebSocket sync issues
        // The blob URL needs to exist until the content is saved and synced
        setTimeout(() => {
          const oldImg = document.querySelector(`img[src^="blob:"]`);
          if (oldImg && oldImg.src.startsWith('blob:')) {
            URL.revokeObjectURL(oldImg.src);
          }
        }, 2000); // 2 second delay to ensure sync completes
        
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
        placeholder.remove();
        // Clean up blob URL after removal
        setTimeout(() => {
          const blobImgs = document.querySelectorAll('img[src^="blob:"]');
          blobImgs.forEach(img => {
            if (!document.contains(img)) {
              URL.revokeObjectURL(img.src);
            }
          });
        }, 100);
      }
      
      // Remove from tracking (ref, no re-render)
      uploadingImagesRef.current.delete(tempId);
      
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
      
      {/* Saving Indicator — always mounted, shown/hidden via direct DOM ref (no React re-render) */}
      <div
        ref={savingIndicatorRef}
        style={{ display: 'none' }}
        className="absolute bottom-4 right-4 bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full shadow-lg items-center gap-1"
      >
        Saving...
      </div>
    </>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

// Memoized inner editor — never re-renders due to socket or parent state changes.
// It only re-renders if its own props change, which they never do (ref is stable,
// socketRef/connectedRef are stable ref objects whose .current is updated externally).
const MemoizedEditor = memo(RichTextEditor);

// Wrapper component: the ONLY component that subscribes to SocketContext.
// It holds stable refs for socket and connected, updates them imperatively when
// the socket reconnects, and passes them to the memoized editor as stable props.
// This way, socket reconnects cause this tiny wrapper to re-render but do NOT
// cause the contentEditable editor to re-render — so the cursor never resets.
const RichTextEditorWrapper = forwardRef((props, ref) => {
  const { socket, connected } = useSocket();

  // Stable ref objects — identity never changes, only .current changes.
  // MemoizedEditor receives these as props; since ref identity is stable,
  // memo() sees no prop change and skips re-rendering the editor.
  const socketRef = useRef(socket);
  const connectedRef = useRef(connected);

  // Keep refs current without causing editor re-renders
  socketRef.current = socket;
  connectedRef.current = connected;

  return (
    <MemoizedEditor
      ref={ref}
      socketRef={socketRef}
      connectedRef={connectedRef}
      {...props}
    />
  );
});

RichTextEditorWrapper.displayName = 'RichTextEditorWrapper';

export default RichTextEditorWrapper;