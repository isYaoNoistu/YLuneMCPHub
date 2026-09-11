import React from 'react';
import { useTranslation } from 'react-i18next';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
}) => {
  const { t } = useTranslation();

  if (totalPages <= 1) {
    return null;
  }

  const pages: Array<number | 'ellipsis'> = [];
  const windowSize = 5;
  const startPage = Math.max(2, currentPage - Math.floor(windowSize / 2));
  const endPage = Math.min(totalPages - 1, startPage + windowSize - 3);

  pages.push(1);
  if (startPage > 2) pages.push('ellipsis');
  for (let i = startPage; i <= endPage; i += 1) pages.push(i);
  if (endPage < totalPages - 1) pages.push('ellipsis');
  if (totalPages > 1) pages.push(totalPages);

  return (
    <div className="hub-pager">
      <button
        type="button"
        className="hub-btn"
        disabled={disabled || currentPage === 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
      >
        {t('common.previous')}
      </button>
      {pages.map((item, index) =>
        item === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className="hub-pager-meta">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            className={`hub-btn${currentPage === item ? ' primary' : ''}`}
            disabled={disabled}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        className="hub-btn"
        disabled={disabled || currentPage === totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
      >
        {t('common.next')}
      </button>
    </div>
  );
};

export default Pagination;
