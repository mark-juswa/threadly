import { useState, useEffect } from 'react';

const ImageModal = () => {
  const [imageSrc, setImageSrc] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Global function to expand images
    window.expandImage = (img) => {
      setImageSrc(img.src);
      setIsOpen(true);
    };

    return () => {
      delete window.expandImage;
    };
  }, []);

  const closeModal = () => {
    setIsOpen(false);
    setImageSrc('');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center cursor-zoom-out fade-in"
      onClick={closeModal}
    >
      <img
        src={imageSrc}
        alt="Expanded view"
        className="max-w-[95%] max-h-[95%] object-contain rounded-lg shadow-2xl"
      />
    </div>
  );
};

export default ImageModal;