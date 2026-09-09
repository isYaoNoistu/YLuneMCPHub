import React, { ReactNode } from 'react';

interface ContentProps {
  children: ReactNode;
}

const Content: React.FC<ContentProps> = ({ children }) => {
  return (
    <main id="mainView" className="view-wrap">
      <div className="view is-page">{children}</div>
    </main>
  );
};

export default Content;
