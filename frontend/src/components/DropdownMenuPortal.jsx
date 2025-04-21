import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

const DropdownMenuPortal = ({ anchorRef, isOpen, children, className = '' }) => {
  const [styles, setStyles] = useState({});

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setStyles({
        position: 'absolute',
        top: rect.bottom + window.scrollY + 10,
        left: rect.left + window.scrollX,
        width: rect.width,
        zIndex: 1000,
      });
    }
  }, [isOpen, anchorRef]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <ul className={className} style={styles}>
      {children}
    </ul>,
    document.body
  );
};

DropdownMenuPortal.propTypes = {
  anchorRef: PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  isOpen: PropTypes.bool.isRequired,
  children: PropTypes.node,
  className: PropTypes.string
};

export default DropdownMenuPortal;
