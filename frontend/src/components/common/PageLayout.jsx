import React from 'react';
import Sidebar from './Sidebar';
import Navbar  from './Navbar';
import Loader  from './Loader';

/**
 * PageLayout — shared shell for every protected page.
 * Props:
 *   loading  — show loader instead of content
 *   children — page body
 */
const PageLayout = ({ loading = false, children }) => (
  <div className="app-layout">
    <Sidebar />
    <div className="main-content">
      <Navbar />
      {loading
        ? <Loader message="Loading…" />
        : <main className="page-body">{children}</main>
      }
    </div>
  </div>
);

export default PageLayout;
