import { useState, useEffect, useRef } from 'react';

const FloatingToolbar = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  // pinnedRef tracks whether the toolbar is pinned via Alt+` so that
  // it stays visible even when there is no active text selection.
  const pinnedRef = useRef(false);

  // Compute a position for the toolbar based on the current cursor / selection.
  // Returns null when the cursor is not inside the editor.
  const getPositionFromCursor = () => {
    const selection = window.getSelection();
    const editor = document.getElementById('editor');
    if (!editor) return null;

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        const rect = range.getBoundingClientRect();
        // For a collapsed cursor rect.width === 0 — use left/top directly.
        return {
          x: rect.left + rect.width / 2,
          y: rect.top,
        };
      }
    }

    // Fallback: centre of the editor
    const editorRect = editor.getBoundingClientRect();
    return {
      x: editorRect.left + editorRect.width / 2,
      y: editorRect.top + 60,
    };
  };

  useEffect(() => {
    // ── Selection-driven visibility (original behaviour) ──────────────────────
    const handleSelectionChange = () => {
      // Don't hide when toolbar is pinned — pinned mode controls its own visibility.
      if (pinnedRef.current) return;

      setTimeout(() => {
        const selection = window.getSelection();

        if (!selection.rangeCount || selection.isCollapsed) {
          setVisible(false);
          setShowColorPicker(false);
          return;
        }

        const range = selection.getRangeAt(0);
        const editor = document.getElementById('editor');

        if (!editor || !editor.contains(range.commonAncestorContainer)) {
          setVisible(false);
          return;
        }

        const rect = range.getBoundingClientRect();

        if (rect.width > 0) {
          setPosition({
            x: rect.left + rect.width / 2,
            y: rect.top,
          });
          setVisible(true);
        }
      }, 10);
    };

    const handleMouseUp = () => {
      handleSelectionChange();
    };

    const handleScroll = () => {
      // Only hide on scroll when not pinned
      if (!pinnedRef.current) setVisible(false);
    };

    // ── Alt+` toggle handler ──────────────────────────────────────────────────
    const handleToggle = () => {
      if (pinnedRef.current) {
        // Unpin and hide
        pinnedRef.current = false;
        setVisible(false);
        setShowColorPicker(false);
      } else {
        // Pin and show at current cursor position
        const pos = getPositionFromCursor();
        pinnedRef.current = true;
        if (pos) setPosition(pos);
        setVisible(true);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keyup', handleSelectionChange);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('toggleFloatingToolbar', handleToggle);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keyup', handleSelectionChange);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('toggleFloatingToolbar', handleToggle);
    };
  }, []);

  // Save and restore selection to ensure formatting works correctly
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      return selection.getRangeAt(0).cloneRange();
    }
    return null;
  };

  const restoreSelection = (range) => {
    if (range) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  const formatDoc = (cmd, value = null) => {
    // Save selection before any DOM operations
    const savedRange = saveSelection();
    
    // Ensure styleWithCSS is enabled for consistent behavior
    document.execCommand('styleWithCSS', false, true);
    
    // Restore selection to ensure it's active
    restoreSelection(savedRange);
    
    // Execute the formatting command
    document.execCommand(cmd, false, value);
    
    // Keep focus on editor
    document.getElementById('editor')?.focus();
  };

  const toggleBlock = (tag) => {
    const currentBlock = document.queryCommandValue('formatBlock');
    if (currentBlock && currentBlock.toLowerCase() === tag) {
      document.execCommand('formatBlock', false, 'p');
    } else {
      document.execCommand('formatBlock', false, tag);
    }
    document.getElementById('editor')?.focus();
  };

  const toggleTextColor = () => {
    const savedRange = saveSelection();
    document.execCommand('styleWithCSS', false, true);
    restoreSelection(savedRange);
    
    const currentColor = document.queryCommandValue('foreColor');
    
    if (currentColor === 'rgb(239, 68, 68)' || currentColor === '#ef4444') {
      document.execCommand('foreColor', false, '#d1d5db');
    } else {
      document.execCommand('foreColor', false, '#ef4444');
    }
    document.getElementById('editor')?.focus();
  };

  const toggleHighlight = (color = '#fde047') => {
    const savedRange = saveSelection();
    document.execCommand('styleWithCSS', false, true);
    restoreSelection(savedRange);
    
    const bgColor = document.queryCommandValue('backColor');
    
    // Convert hex to rgb for comparison
    const hexToRgb = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgb(${r}, ${g}, ${b})`;
    };
    
    const rgbColor = hexToRgb(color);
    
    if (bgColor === rgbColor) {
      document.execCommand('hiliteColor', false, 'transparent');
      document.execCommand('foreColor', false, '#d1d5db');
    } else {
      document.execCommand('hiliteColor', false, color);
      document.execCommand('foreColor', false, '#111827');
    }
    document.getElementById('editor')?.focus();
  };

  const transformCase = (type) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString();
    
    let transformedText;
    if (type === 'uppercase') {
      transformedText = selectedText.toUpperCase();
    } else if (type === 'lowercase') {
      transformedText = selectedText.toLowerCase();
    } else if (type === 'capitalize') {
      // Capitalize first letter of each word and lowercase the rest
      transformedText = selectedText.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    }

    // Delete the selected content and insert transformed text
    range.deleteContents();
    const textNode = document.createTextNode(transformedText);
    range.insertNode(textNode);

    // Re-select the transformed text
    const newRange = document.createRange();
    newRange.selectNodeContents(textNode);
    selection.removeAllRanges();
    selection.addRange(newRange);

    document.getElementById('editor')?.focus();
  };

  const insertChecklist = () => {
    // Get the current selection and preserve text if any
    const selection = window.getSelection();
    let selectedText = '';
    
    if (selection && selection.rangeCount > 0) {
      selectedText = selection.toString().trim();
    }
    
    // Create checklist HTML with the selected text preserved
    const checklistHtml = `
      <div class="checklist-item flex items-center gap-2 my-1" contenteditable="false">
        <span 
          class="checklist-checkbox w-4 h-4 rounded-full border-2 border-gray-400 cursor-pointer flex-shrink-0 hover:border-green-500 transition"
          onclick="(function(el) {
            const textSpan = el.nextElementSibling;
            const isChecked = el.getAttribute('data-checked') === 'true';
            if (isChecked) {
              el.setAttribute('data-checked', 'false');
              el.classList.remove('bg-green-500', 'border-green-500');
              el.classList.add('border-gray-400');
              el.innerHTML = '';
              textSpan.classList.remove('line-through', 'text-gray-500');
            } else {
              el.setAttribute('data-checked', 'true');
              el.classList.remove('border-gray-400');
              el.classList.add('bg-green-500', 'border-green-500');
              el.innerHTML = '<svg class=&quot;w-3 h-3 text-white&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; viewBox=&quot;0 0 24 24&quot;><path stroke-linecap=&quot;round&quot; stroke-linejoin=&quot;round&quot; stroke-width=&quot;3&quot; d=&quot;M5 13l4 4L19 7&quot;></path></svg>';
              textSpan.classList.add('line-through', 'text-gray-500');
            }
          })(this)"
          data-checked="false"
        ></span>
        <span 
          class="checklist-text text-gray-300" 
          contenteditable="true"
          onkeydown="(function(e, el) {
            if (e.key === 'Enter') {
              e.preventDefault();
              const checklistItem = el.parentElement;
              const textContent = el.textContent.trim();
              
              // If current item is empty, exit checklist mode (Notion-style double Enter)
              if (textContent === '') {
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                checklistItem.insertAdjacentElement('afterend', p);
                checklistItem.remove();
                
                // Focus on the new paragraph
                const range = document.createRange();
                const sel = window.getSelection();
                range.setStart(p, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                p.focus();
                return;
              }
              
              // Create new checklist item
              const newItem = checklistItem.cloneNode(true);
              const newTextSpan = newItem.querySelector('.checklist-text');
              const newCheckbox = newItem.querySelector('.checklist-checkbox');
              newTextSpan.textContent = '';
              newCheckbox.setAttribute('data-checked', 'false');
              newCheckbox.classList.remove('bg-green-500', 'border-green-500');
              newCheckbox.classList.add('border-gray-400');
              newCheckbox.innerHTML = '';
              newTextSpan.classList.remove('line-through', 'text-gray-500');
              checklistItem.insertAdjacentElement('afterend', newItem);
              
              // Focus on new item
              const range = document.createRange();
              const sel = window.getSelection();
              range.setStart(newTextSpan, 0);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
              newTextSpan.focus();
            } else if (e.key === 'Backspace') {
              const textContent = el.textContent;
              const sel = window.getSelection();
              const isAtStart = sel && sel.rangeCount > 0 && sel.getRangeAt(0).startOffset === 0 && sel.isCollapsed;
              
              // Only handle backspace if item is empty OR cursor is at the very start
              if (textContent === '' || (isAtStart && textContent.length > 0)) {
                if (textContent === '') {
                  e.preventDefault();
                  const checklistItem = el.parentElement;
                  const prevSibling = checklistItem.previousElementSibling;
                  
                  // Convert to paragraph (exit checklist mode)
                  const p = document.createElement('p');
                  p.innerHTML = '<br>';
                  checklistItem.insertAdjacentElement('afterend', p);
                  checklistItem.remove();
                  
                  // Focus on the new paragraph
                  const range = document.createRange();
                  const selection = window.getSelection();
                  range.setStart(p, 0);
                  range.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(range);
                }
                // If there's text and cursor is at start, let default behavior happen (merge with previous)
              }
              // Otherwise, let default backspace behavior delete characters
            }
          })(event, this)"
        >${selectedText}</span>
      </div>
    `;
    
    document.execCommand('insertHTML', false, checklistHtml);
    
    // Focus on the newly created checklist text span
    setTimeout(() => {
      const editor = document.getElementById('editor');
      if (editor) {
        const checklistItems = editor.querySelectorAll('.checklist-text');
        const lastItem = checklistItems[checklistItems.length - 1];
        if (lastItem) {
          const range = document.createRange();
          const sel = window.getSelection();
          // If there was selected text, place cursor at the end
          if (selectedText) {
            range.selectNodeContents(lastItem);
            range.collapse(false); // collapse to end
          } else {
            range.setStart(lastItem, 0);
            range.collapse(true);
          }
          sel.removeAllRanges();
          sel.addRange(range);
          lastItem.focus();
        }
      }
    }, 10);
  };

  if (!visible) return null;

  return (
    <div
      id="floating-toolbar"
      className="fixed z-50 bg-[#1c1c1c] border border-gray-700 rounded-lg shadow-2xl flex items-center p-1.5 gap-0.5 floating-toolbar visible"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
        transform: 'translate(-50%, -100%)',
        marginTop: '-12px',
        // Subtle blue border tint when pinned so users know it's in pinned mode
        ...(pinnedRef.current && { borderColor: '#3b82f6' }),
      }}
      title={pinnedRef.current ? 'Floating toolbar (pinned — press Alt+` to close)' : 'Floating toolbar'}
    >
      {/* Bold */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          formatDoc('bold');
        }}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition"
        title="Bold (Ctrl+B)"
      >
        <strong className="font-serif">B</strong>
      </button>

      {/* Italic */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          formatDoc('italic');
        }}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition"
        title="Italic (Ctrl+I)"
      >
        <em className="font-serif">I</em>
      </button>

      {/* Underline */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          formatDoc('underline');
        }}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition"
        title="Underline (Ctrl+U)"
      >
        <span className="underline">U</span>
      </button>

      {/* Uppercase */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          transformCase('uppercase');
        }}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition text-xs font-bold"
        title="Uppercase"
      >
        AA
      </button>

      {/* Lowercase */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          transformCase('lowercase');
        }}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition text-xs font-bold"
        title="Lowercase"
      >
        aa
      </button>

      {/* Capitalize Each Word */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          transformCase('capitalize');
        }}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition text-xs font-bold"
        title="Capitalize Each Word"
      >
        Ab
      </button>

      {/* Text Color */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          toggleTextColor();
        }}
        className="p-1.5 text-gray-400 hover:bg-gray-700 rounded transition"
        title="Text Color (Red/Default)"
      >
        <span className="font-serif font-bold text-red-500 text-lg">A</span>
      </button>

      {/* Highlight Button */}
      <div className="relative flex items-center">
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            setShowColorPicker(!showColorPicker);
          }}
          className={`p-1.5 rounded transition ${showColorPicker ? 'text-yellow-400 bg-gray-700' : 'text-gray-400 hover:text-yellow-400 hover:bg-gray-700'}`}
          title="Highlight Palette"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>

        {/* Color Palette Popup */}
        {showColorPicker && (
          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-[#1c1c1c] border border-gray-700 rounded-full shadow-xl flex items-center p-1 gap-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {[
              { name: 'Yellow', color: '#fde047' },
              { name: 'Green', color: '#86efac' },
              { name: 'Blue', color: '#93c5fd' },
              { name: 'Purple', color: '#d8b4fe' },
              { name: 'Rose', color: '#fda4af' }
            ].map((c) => (
              <button
                key={c.color}
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggleHighlight(c.color);
                  setShowColorPicker(false);
                }}
                className="w-6 h-6 rounded-full border border-white/10 hover:scale-110 hover:border-white transition shadow-sm"
                style={{ backgroundColor: c.color }}
                title={c.name}
              />
            ))}
            <button
               onMouseDown={(e) => {
                 e.preventDefault();
                 toggleHighlight('#fde047'); // Default yellow for clear if it matches, but actually remove is better
                 // We need a clear button
               }}
               className="hidden"
            />
             <div className="w-px h-4 bg-gray-700 mx-0.5" />
             <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  const savedRange = saveSelection();
                  document.execCommand('styleWithCSS', false, true);
                  restoreSelection(savedRange);
                  document.execCommand('hiliteColor', false, 'transparent');
                  document.execCommand('foreColor', false, '#d1d5db');
                  setShowColorPicker(false);
                }}
                className="p-1 text-gray-400 hover:text-white transition"
                title="Remove Highlight"
             >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
               </svg>
             </button>
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-gray-700 mx-1.5" />

      {/* Headings */}
      <button onMouseDown={(e) => { e.preventDefault(); toggleBlock('h1'); }} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition font-bold text-sm" title="Heading 1 (Alt+1)">H1</button>
      <button onMouseDown={(e) => { e.preventDefault(); toggleBlock('h2'); }} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition font-bold text-sm" title="Heading 2 (Alt+2)">H2</button>
      <button onMouseDown={(e) => { e.preventDefault(); toggleBlock('h3'); }} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition font-bold text-sm" title="Heading 3 (Alt+3)">H3</button>

      <div className="w-px h-5 bg-gray-700 mx-1.5" />

      {/* Lists */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          formatDoc('insertUnorderedList');
        }}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition"
        title="Bullet List (Alt+Q)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          formatDoc('insertOrderedList');
        }}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition"
        title="Numbered List"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
      </button>

      {/* Checklist */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          insertChecklist();
        }}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition"
        title="Checklist"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      <div className="w-px h-5 bg-gray-700 mx-1.5" />

      {/* Clear Formatting */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          toggleBlock('p');
          formatDoc('removeFormat');
        }}
        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition"
        title="Clear Formatting"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      {/* Arrow */}
      <div className="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-[#1c1c1c] border-b border-r border-gray-700 rotate-45" />
    </div>
  );
};

export default FloatingToolbar;