import { useState, useEffect } from 'react';
import api, { BASE_URL } from '../assets/js/axiosConfig';

// Components — each handles one step's UI only
import FileUploadStep from '../components/FileUploadStep';
import ConfigureStep  from '../components/ConfigureStep';
import ImportResults  from '../components/ImportResults';

const IMPORT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// ---------------------------------------------------------------
// MdbImport — Main Page
//
// This file owns ALL state and ALL API calls.
// It passes data down to child components via props.
// Child components call back up via callback props (onXxx).
//
// Steps:
//   1 → FileUploadStep  — user picks .mdb file
//   2 → ConfigureStep   — user picks company + optional password
//   3 → ImportResults   — shows what was imported / skipped
// ---------------------------------------------------------------

// ---- Small shared UI: Step indicator at the top ----
function StepBadge({ number, label, active, done }) {
  return (
    <div className={`flex items-center gap-2 transition-opacity ${active ? 'opacity-100' : done ? 'opacity-60' : 'opacity-30'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
        ${done ? 'bg-emerald-500 text-white' : active ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-500'}`}>
        {done ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : number}
      </div>
      <span className={`text-sm font-medium hidden md:block ${active ? 'text-slate-800' : 'text-slate-500'}`}>
        {label}
      </span>
    </div>
  );
}

function StepDivider() {
  return <div className="flex-1 h-px bg-slate-200 mx-2 hidden md:block" />;
}

// ================================================================

export default function MdbImport() {

  // ---- Step tracking ----
  // 1 = file upload, 2 = configure, 3 = results
  const [step, setStep] = useState(1);

  // ---- Step 1 state ----
  const [selectedFile, setSelectedFile]   = useState(null);
  const [isDragging, setIsDragging]       = useState(false);

  // ---- Step 2 state ----
  const [companies, setCompanies]               = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [mdbPassword, setMdbPassword]           = useState('');

  // ---- Import / Step 3 state ----
  const [importing, setImporting]       = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError]   = useState('');


  // ==================== EFFECTS ====================

  // Fetch companies once on mount so the dropdown is ready when user reaches step 2
  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const response = await api.get(`${BASE_URL}/customer-data`);
      setCompanies(response.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch companies:', err);
    } finally {
      setLoadingCompanies(false);
    }
  };


  // ==================== STEP 1 HANDLERS ====================

  // Called by FileUploadStep when user picks or drops a valid file
  const handleFileSelect = (file) => setSelectedFile(file);

  const handleFileRemove = () => setSelectedFile(null);

  // Called when user presses Continue on step 1
  const handleProceedToConfig = () => {
    if (selectedFile) setStep(2);
  };


  // ==================== STEP 2 HANDLERS ====================

  const handleCompanyChange = (id) => setSelectedCompanyId(id);

  // When checkbox is toggled off, also clear the password value
  const handlePasswordProtectedChange = (checked) => {
    setIsPasswordProtected(checked);
    if (!checked) setMdbPassword('');
  };

  const handlePasswordChange = (val) => setMdbPassword(val);

  const handleBackToUpload = () => {
    setStep(1);
    setImportError('');
  };


  // ==================== IMPORT (API CALL) ====================

  const handleImport = async () => {
    if (!selectedFile)      return window.alert('No file selected.');
    if (!selectedCompanyId) return window.alert('Please select a company.');
    if (isPasswordProtected && !mdbPassword.trim()) return window.alert('Please enter the MDB password.');

    setImporting(true);
    setImportError('');

    /*
      FormData is used here because we're sending a FILE + text fields together.
      JSON cannot carry binary file data.
      Do NOT set Content-Type manually — axios sets multipart/form-data automatically.
    */
    const formData = new FormData();
    formData.append('mdb_file',    selectedFile);
    formData.append('company_id',  selectedCompanyId);
    if (isPasswordProtected && mdbPassword.trim()) {
      formData.append('password',  mdbPassword.trim());
    }

    try {
      const response = await api.post(`${BASE_URL}/import-mdb`, formData, {
        headers: { 'Content-Type': undefined },
        timeout: IMPORT_TIMEOUT_MS,
      });

      // SUCCESS — response.data must have imported/skipped/table_results shape
      if (response.data && (response.data.imported !== undefined || response.data.table_results)) {
        setImportResult(response.data);
        setStep(3);
      } else {
        // Got 200 but unexpected shape — show raw message
        setImportError(response.data?.message || 'Import returned unexpected response.');
      }

    } catch (err) {
      // err.response exists when server replied with 4xx/5xx
      // err.response is undefined on network errors or CORS failures
      const responseData = err.response?.data;

      let errorMessage = 'Import failed. Please try again.';

      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Import timed out. The file is large or server is busy. Please retry and check backend logs.';
      } else if (responseData) {
        // Server returned JSON with a message field
        if (typeof responseData === 'object') {
          errorMessage = responseData.message || responseData.error || responseData.detail || JSON.stringify(responseData);
        } else if (typeof responseData === 'string' && !responseData.startsWith('<')) {
          // Only show string response if it is NOT an HTML error page
          errorMessage = responseData;
        } else {
          // HTML response means Django crashed with an unhandled 500
          errorMessage = `Server error (${err.response.status}). Check Django logs for details.`;
        }
      } else if (err.message) {
        errorMessage = `Network error: ${err.message}`;
      }

      setImportError(errorMessage);
    } finally {
      // This ALWAYS runs — guarantees spinner stops no matter what
      setImporting(false);
    }
  };


  // ==================== RESET ====================

  // Called from ImportResults when user clicks "Import Another File"
  const handleReset = () => {
    setStep(1);
    setSelectedFile(null);
    setSelectedCompanyId('');
    setIsPasswordProtected(false);
    setMdbPassword('');
    setImportResult(null);
    setImportError('');
  };


  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Import MDB Data</h1>
          <p className="text-slate-500 text-sm mt-1">
            Upload a Microsoft Access (.mdb) file to import data into the system.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center mb-8 px-2">
          <StepBadge number="1" label="Select File" active={step === 1} done={step > 1} />
          <StepDivider />
          <StepBadge number="2" label="Configure"   active={step === 2} done={step > 2} />
          <StepDivider />
          <StepBadge number="3" label="Results"     active={step === 3} done={false} />
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

          {/* Step 1 */}
          {step === 1 && (
            <FileUploadStep
              selectedFile={selectedFile}
              isDragging={isDragging}
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              onDragChange={setIsDragging}
              onContinue={handleProceedToConfig}
            />
          )}

          {/* Step 2 */}
          {step === 2 && (
            <ConfigureStep
              selectedFile={selectedFile}
              companies={companies}
              loadingCompanies={loadingCompanies}
              selectedCompanyId={selectedCompanyId}
              onCompanyChange={handleCompanyChange}
              isPasswordProtected={isPasswordProtected}
              mdbPassword={mdbPassword}
              onPasswordProtectedChange={handlePasswordProtectedChange}
              onPasswordChange={handlePasswordChange}
              onBack={handleBackToUpload}
              onImport={handleImport}
              importing={importing}
              importError={importError}
            />
          )}

          {/* Step 3 */}
          {step === 3 && importResult && (
            <ImportResults
              result={importResult}
              onReset={handleReset}
            />
          )}

        </div>

        <p className="text-xs text-slate-400 text-center mt-5">
          Only Microsoft Access .mdb files are supported.
        </p>
      </div>
    </div>
  );
}
