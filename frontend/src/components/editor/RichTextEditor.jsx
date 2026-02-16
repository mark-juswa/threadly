import { useEffect, useRef, useState } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { uploadService } from '../../api/uploadService';

const RichTextEditor = () => {
  const editorRef = useRef(null);
  const { currentNote, updateNote } = useNotes();
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef(null);

  // Load current note content
  useEffect(() => {
    if (editorRef.current && currentNote) {
      editorRef.current.innerHTML = currentNote.content || '';
    } else if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
  }, [currentNote]);

  // Auto-save on content change (debounced)
  const handleContentChange = () => {
    if (!currentNote) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(async () => {
      const content = editorRef.current.innerHTML;
      setIsSaving(true);
      
      await updateNote(currentNote._id, { content });
      
      setIsSaving(false);
    }, 1000); // Save after 1 second of no typing
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

  return (
    <>
      <div
        ref={editorRef}
        id="editor"
        contentEditable={!!currentNote}
        className="w-full h-full overflow-y-auto bg-transparent focus:outline-none text-gray-300 p-8 text-md font-light leading-relaxed empty:before:content-[attr(placeholder)] empty:before:text-gray-600"
        placeholder={currentNote ? "Type '# ' for Heading, '- ' for list, or select text to format..." : "Select a note to start editing"}
        onKeyUp={handleKeyUp}
        onInput={handleContentChange}
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
};

export default RichTextEditor;