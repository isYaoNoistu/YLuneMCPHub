import React from 'react';
import { useTranslation } from 'react-i18next';

interface CursorPaginationProps {
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
}

const CursorPagination: React.FC<CursorPaginationProps> = ({
  currentPage,
  hasNextPage,
  hasPreviousPage,
  onNextPage,
  onPreviousPage,
}) => {
  const { t } = useTranslation();

  return (
    <div className="hub-pager">
      <button type="button" className="hub-btn" disabled={!hasPreviousPage} onClick={onPreviousPage}>
        {t('common.previous')}
      </button>
      <span className="hub-pager-meta">{currentPage}</span>
      <button type="button" className="hub-btn" disabled={!hasNextPage} onClick={onNextPage}>
        {t('common.next')}
      </button>
    </div>
  );
};

export default CursorPagination;
