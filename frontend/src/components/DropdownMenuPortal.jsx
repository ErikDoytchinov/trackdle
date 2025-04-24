import React from 'react';
import PropTypes from 'prop-types';
import { useFloating, autoUpdate, offset, flip, shift } from '@floating-ui/react';

const DropdownMenuPortal = ({ anchorRef, isOpen, children, className = '' }) => {
  const { refs, floatingStyles } = useFloating({
    elements: {
      reference: anchorRef.current,
    },
    placement: 'bottom-start',
    middleware: [offset(10), flip(), shift()],
    whileElementsMounted: autoUpdate,
  });

  if (!isOpen) return null;

  return (
    <ul
      ref={refs.setFloating}
      className={className}
      style={{ ...floatingStyles, zIndex: 1000 }}
    >
      {children}
    </ul>
  );
};

DropdownMenuPortal.propTypes = {
  anchorRef: PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  isOpen: PropTypes.bool.isRequired,
  children: PropTypes.node,
  className: PropTypes.string,
};

export default DropdownMenuPortal;
