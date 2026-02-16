import { useState, useEffect, useCallback, useRef } from 'react';

export const useContextMenu = () => {
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    type: null,
    data: null,
  });
  
  // Track if we should skip the next document click
  const skipNextClick = useRef(false);

  const showContextMenu = useCallback((e, type, data = null) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      data,
    });
  }, []);

  const hideContextMenu = useCallback((skipDocumentClick = false) => {
    if (skipDocumentClick) {
      skipNextClick.current = true;
    }
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  // Hide context menu on click outside
  useEffect(() => {
    const handleClick = (e) => {
      // Skip this click if flagged (e.g., when clicking an action button)
      if (skipNextClick.current) {
        skipNextClick.current = false;
        return;
      }
      hideContextMenu();
    };
    
    if (contextMenu.visible) {
      // Use a small delay to avoid catching the same click that opened the menu
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClick);
      }, 0);
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClick);
      };
    }
  }, [contextMenu.visible, hideContextMenu]);

  return {
    contextMenu,
    showContextMenu,
    hideContextMenu,
  };
};