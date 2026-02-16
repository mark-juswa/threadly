import { useState, useEffect } from 'react';

const FloatingToolbar = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleSelectionChange = () => {
      setTimeout(() => {
        const selection = window.getSelection();
        
        if (!selection.rangeCount || selection.isCollapsed) {
          setVisible(false);
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
            x: rect.left + (rect.width / 2),
            y: rect.top
          });
          setVisible(true);
        }
      }, 10);
    };

    const handleMouseUp = () => {
      handleSelectionChange();
    };

    const handleScroll = () => {
      setVisible(false);
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keyup', handleSelectionChange);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keyup', handleSelectionChange);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  const formatDoc = (cmd, value = null) => {
    document.execCommand(cmd, false, value);
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
    document.execCommand('styleWithCSS', false, true);
    const currentColor = document.queryCommandValue('foreColor');
    
    if (currentColor === 'rgb(239, 68, 68)' || currentColor === '#ef4444') {
      document.execCommand('foreColor', false, '#d1d5db');
    } else {
      document.execCommand('foreColor', false, '#ef4444');
    }
  };

  const toggleHighlight = () => {
    const bgColor = document.queryCommandValue('backColor');
    
    if (bgColor === 'rgb(250, 204, 21)' || bgColor === '#facc15') {
      document.execCommand('hiliteColor', false, 'transparent');
      document.execCommand('foreColor', false, '#d1d5db');
    } else {
      document.execCommand('hiliteColor', false, '#facc15');
      document.execCommand('foreColor', false, 'black');
    }
  };

  const insertChecklist = () => {
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
            if ((e.key === 'Backspace' || e.key === 'Delete') && el.textContent.trim() === '') {
              e.preventDefault();
              const checklistItem = el.parentElement;
              const nextSibling = checklistItem.nextSibling;
              const prevSibling = checklistItem.previousSibling;
              checklistItem.remove();
              // Move cursor to appropriate position
              const editor = document.getElementById('editor');
              if (editor) {
                editor.focus();
                if (nextSibling && nextSibling.nodeType === 1) {
                  const range = document.createRange();
                  const sel = window.getSelection();
                  range.setStart(nextSibling, 0);
                  range.collapse(true);
                  sel.removeAllRanges();
                  sel.addRange(range);
                }
              }
            }
          })(event, this)"
        >Checklist item</span>
      </div>
    `;
    document.execCommand('insertHTML', false, checklistHtml);
    document.getElementById('editor')?.focus();
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
        marginTop: '-12px'
      }}
    >
      {/* Bold */}
      <button
        onClick={() => formatDoc('bold')}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition"
        title="Bold"
      >
        <strong className="font-serif">B</strong>
      </button>

      {/* Italic */}
      <button
        onClick={() => formatDoc('italic')}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition"
        title="Italic"
      >
        <em className="font-serif">I</em>
      </button>

      {/* Underline */}
      <button
        onClick={() => formatDoc('underline')}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition"
        title="Underline"
      >
        <span className="underline">U</span>
      </button>

      {/* Text Color */}
      <button
        onClick={toggleTextColor}
        className="p-1.5 text-gray-400 hover:bg-gray-700 rounded transition"
        title="Text Color (Red/Default)"
      >
        <span className="font-serif font-bold text-red-500 text-lg">A</span>
      </button>

      {/* Highlight */}
      <button
        onClick={toggleHighlight}
        className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded transition"
        title="Highlight"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>

      <div className="w-px h-5 bg-gray-700 mx-1.5" />

      {/* Headings */}
      <button onClick={() => toggleBlock('h1')} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition font-bold text-sm">H1</button>
      <button onClick={() => toggleBlock('h2')} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition font-bold text-sm">H2</button>
      <button onClick={() => toggleBlock('h3')} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition font-bold text-sm">H3</button>

      <div className="w-px h-5 bg-gray-700 mx-1.5" />

      {/* Lists */}
      <button
        onClick={() => formatDoc('insertUnorderedList')}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition"
        title="Bullet List"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      <button
        onClick={() => formatDoc('insertOrderedList')}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition"
        title="Numbered List"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
      </button>

      {/* Checklist */}
      <button
        onClick={insertChecklist}
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
        onClick={() => {
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