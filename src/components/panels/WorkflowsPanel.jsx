import { Download, Check, RefreshCw, HardDrive, Upload, Loader2, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { useState, useRef, useCallback } from 'react'
import useWorkflowsStore from '../../stores/workflowsStore'

function WorkflowsPanel() {
  const [selectedWorkflow, setSelectedWorkflow] = useState(null)
  const [filter, setFilter] = useState('all')
  const [expandedCategories, setExpandedCategories] = useState(['Custom'])
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState(null)
  const fileInputRef = useRef(null)

  const importedWorkflows = useWorkflowsStore(s => s.getImportedWorkflows())
  const importedIds = useWorkflowsStore(s => s.importedIds)
  const removeImportedWorkflow = useWorkflowsStore(s => s.removeImportedWorkflow)
  const importWorkflow = useWorkflowsStore(s => s.importWorkflow)

  const categories = []
  if (importedWorkflows.length > 0) categories.push('Custom')

  const filteredWorkflows = importedWorkflows.filter(w => {
    if (filter === 'installed') return true
    if (filter === 'available') return false
    return true
  })

  const handleImport = useCallback(async () => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelected = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportError(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      if (!json || typeof json !== 'object') throw new Error('Invalid workflow JSON')
      await importWorkflow(json, file.name)
    } catch (err) {
      setImportError(err.message || 'Failed to import workflow')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }, [importWorkflow])

  const handleRemove = useCallback(async (id, e) => {
    e.stopPropagation()
    if (selectedWorkflow?.id === id) setSelectedWorkflow(null)
    await removeImportedWorkflow(id)
  }, [removeImportedWorkflow])

  const toggleCategory = useCallback((cat) => {
    setExpandedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-2 border-b border-sf-dark-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-sf-text-primary">Workflows</span>
          <button
            onClick={handleImport}
            disabled={importing}
            className="p-1 hover:bg-sf-dark-700 rounded transition-colors flex items-center gap-1 text-[10px] text-sf-text-muted hover:text-sf-text-primary"
            title="Import workflow from JSON file"
          >
            {importing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span>Import</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileSelected}
        />

        {importError && (
          <div className="mb-2 px-2 py-1 bg-red-900/30 border border-red-800 rounded text-[10px] text-red-300">
            {importError}
          </div>
        )}

        {/* Filter Tabs */}
        {importedWorkflows.length > 0 && (
          <div className="flex gap-0.5 bg-sf-dark-800 rounded p-0.5">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                filter === 'all' ? 'bg-sf-dark-600 text-sf-text-primary' : 'text-sf-text-muted hover:text-sf-text-secondary'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('installed')}
              className={`flex-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                filter === 'installed' ? 'bg-sf-dark-600 text-sf-text-primary' : 'text-sf-text-muted hover:text-sf-text-secondary'
              }`}
            >
              Imported ({importedWorkflows.length})
            </button>
          </div>
        )}
      </div>

      {/* Workflow List */}
      <div className="flex-1 overflow-y-auto p-2">
        {importedWorkflows.length === 0 && !importing && (
          <div className="px-2 py-8 text-center">
            <Upload className="w-8 h-8 text-sf-text-muted mx-auto mb-2 opacity-40" />
            <p className="text-[10px] text-sf-text-muted mb-3">No imported workflows yet</p>
            <button
              onClick={handleImport}
              className="px-3 py-1.5 bg-sf-accent hover:bg-sf-accent-hover rounded text-[10px] text-white transition-colors"
            >
              Import Workflow JSON
            </button>
          </div>
        )}

        {filteredWorkflows.length > 0 && categories.map(category => {
          const categoryWorkflows = filteredWorkflows.filter(() => true)
          if (categoryWorkflows.length === 0) return null
          const isExpanded = expandedCategories.includes(category)

          return (
            <div key={category} className="mb-2">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-1 px-1 py-1 text-[10px] text-sf-text-muted uppercase tracking-wider hover:text-sf-text-secondary"
              >
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {category}
              </button>

              {isExpanded && categoryWorkflows.map(workflow => (
                <div
                  key={workflow.id}
                  className={`w-full text-left px-2 py-2 rounded mb-0.5 transition-colors cursor-pointer ${
                    selectedWorkflow?.id === workflow.id
                      ? 'bg-sf-dark-600'
                      : 'hover:bg-sf-dark-700'
                  }`}
                  onClick={() => setSelectedWorkflow(selectedWorkflow?.id === workflow.id ? null : workflow)}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-sf-text-primary truncate flex-1 min-w-0 mr-2">
                      {workflow.name}
                    </span>
                    <Check className="w-3 h-3 text-sf-success flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-sf-text-muted">
                    {workflow.nodeCount != null && (
                      <span>{workflow.nodeCount} nodes</span>
                    )}
                    <span>{new Date(workflow.importedAt).toLocaleDateString()}</span>
                  </div>

                  {/* Expanded details */}
                  {selectedWorkflow?.id === workflow.id && (
                    <div className="mt-2 pt-2 border-t border-sf-dark-600">
                      <button
                        onClick={(e) => handleRemove(workflow.id, e)}
                        className="w-full py-1 bg-sf-dark-700 hover:bg-red-900/50 rounded text-[10px] text-sf-text-muted hover:text-red-300 transition-colors flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default WorkflowsPanel