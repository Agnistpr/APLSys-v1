import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/ocr/components/ui/button';
import { Card } from '@/ocr/components/ui/card';
import { Badge } from '@/ocr/components/ui/badge';
import {
  Search,
  UserCheck,
  Users,
  FileText,
  Shield,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import type { ExtractedText } from './DocumentScanner';

interface Employee {
  employeeid: number;
  name: string;
  firstname?: string;
  lastname?: string;
  middlename?: string;
  department?: string;
  position?: string;
  email?: string;
  contact?: string;
}

interface FieldMapping {
  extractedId: string;
  extractedText: string;
  targetEmployeeField: string;
}

interface EmployeeLinkPanelProps {
  extractedData: ExtractedText[];
  onLinked?: (employeeId: number, updatedFields: string[]) => void;
  onClosed?: () => void;
  // optional extraction passed when opening from a specific extraction
  initialExtraction?: { id: string; text: string } | null;
}

export const EmployeeLinkPanel: React.FC<EmployeeLinkPanelProps> = ({
  extractedData,
  onLinked,
  onClosed,
  initialExtraction = null
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const filteredBySearch = useMemo(() => {
    if (!searchTerm) return filteredEmployees;
    const q = searchTerm.toLowerCase();
    return (filteredEmployees || []).filter(e =>
      String(e.employeeid).includes(searchTerm) ||
      (e.name || '').toLowerCase().includes(q) ||
      (e.firstname || '').toLowerCase().includes(q) ||
      (e.lastname || '').toLowerCase().includes(q)
    );
  }, [filteredEmployees, searchTerm]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);

  // Load all employees on mount
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        setLoading(true);
        console.log('[EmployeeLinkPanel] calling employeeAPI.getEmployees');
        const allEmployees = await window.employeeAPI?.getEmployees?.();
        if (!Array.isArray(allEmployees)) {
          console.warn('[EmployeeLinkPanel] getEmployees did not return an array', allEmployees);
          setEmployees([]);
          setFilteredEmployees([]);
          return;
        }

        // getEmployees returns { employeeid, name, department, position, ... }
        const transformed = allEmployees.map(emp => {
          const parts = String(emp.name || '').split(',').map(s => s.trim());
          const lastname = parts[0] || '';
          const firstname = parts[1] || '';
          return {
            employeeid: emp.employeeid,
            firstname,
            lastname,
            middlename: '',
            name: emp.name || `${firstname} ${lastname}`.trim(),
            department: emp.department || '',
            position: emp.position || '',
            email: emp.email || '',
            contact: emp.contact || ''
          } as Employee;
        });

        setEmployees(transformed);
        setFilteredEmployees(transformed);
      } catch (err) {
        console.error("Error loading employees:", err);
        toast.error("Failed to load employees");
      } finally {
        setLoading(false);
      }
    };

    loadEmployees();
  }, []);

  const handleSelectEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFieldMappings([]);
  };

  const handleAddFieldMapping = (extractedItem: ExtractedText) => {
    // Check if this extracted item is already mapped
    const alreadyMapped = fieldMappings.some(m => m.extractedId === extractedItem.id);
    if (alreadyMapped) {
      toast.error("This extraction is already mapped to a field");
      return;
    }

    setFieldMappings(prev => [...prev, {
      extractedId: extractedItem.id,
      extractedText: extractedItem.text,
      targetEmployeeField: '' // User will select
    }]);
  };

  const handleRemoveFieldMapping = (extractedId: string) => {
    setFieldMappings(prev => prev.filter(m => m.extractedId !== extractedId));
  };

  const handleFieldChange = (extractedId: string, newField: string) => {
    setFieldMappings(prev =>
      prev.map(m => m.extractedId === extractedId ? { ...m, targetEmployeeField: newField } : m)
    );
  };

  const handleUpdateEmployee = async () => {
    if (!selectedEmployee) {
      toast.error("No employee selected");
      return;
    }

    const validMappings = fieldMappings.filter(m => m.targetEmployeeField.trim());
    if (validMappings.length === 0) {
      toast.error("No field mappings selected");
      return;
    }

    setUpdating(true);
    const updatedFields: string[] = [];

    try {
      for (const mapping of validMappings) {
        const { targetEmployeeField, extractedText } = mapping;
        
        // Validate the data before updating
        if (targetEmployeeField === 'contact' && !/^\d{11}$/.test(extractedText.replace(/\D/g, ''))) {
          toast.error(`Invalid contact number format: ${extractedText}`);
          continue;
        }

        if (targetEmployeeField === 'email' && !/^[\w\.-]+@[\w\.-]+\.\w+$/.test(extractedText)) {
          toast.error(`Invalid email format: ${extractedText}`);
          continue;
        }

        await window.employeeAPI.updateEmployee(
          selectedEmployee.employeeid,
          targetEmployeeField,
          extractedText.trim()
        );

        updatedFields.push(targetEmployeeField);
      }

      if (updatedFields.length > 0) {
        // Log the action
        try {
          const fullName = `${selectedEmployee.firstname || ""} ${selectedEmployee.lastname || ""}`.trim();
          await window.userAPI.logAction(
            window.userId,
            `updated ${fullName} from scanned document`,
            `Updated fields: ${updatedFields.join(", ")}`
          );
        } catch (e) {
          console.warn("Failed to log action:", e);
        }

        toast.success("Employee profile updated successfully", {
          description: `Updated ${updatedFields.length} field(s)`,
          duration: 4000
        });

        setFieldMappings([]);
        setSelectedEmployee(null);
        onLinked?.(selectedEmployee.employeeid, updatedFields);
      }
    } catch (err) {
      console.error("Failed to update employee:", err);
      toast.error("Failed to update employee profile");
    } finally {
      setUpdating(false);
    }
  };

  const employeeFields = [
    { key: 'firstname', label: 'First Name' },
    { key: 'middlename', label: 'Middle Name' },
    { key: 'lastname', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'contact', label: 'Contact Number' },
    { key: 'address', label: 'Address' },
    { key: 'gender', label: 'Gender' },
    { key: 'age', label: 'Age' },
    { key: 'birthdate', label: 'Birthdate' },
    { key: 'sss_number', label: 'SSS #' },
    { key: 'pagibig_number', label: 'PAGIBIG #' },
    { key: 'bir_number', label: 'BIR #' },
    { key: 'philhealth_number', label: 'PhilHealth #' },
  ];

  const getUnmappedExtractions = () => {
    const mappedIds = fieldMappings.map(m => m.extractedId);
    return extractedData.filter(item => !mappedIds.includes(item.id));
  };

  // Pre-populate mapping when opened with a single extraction
  useEffect(() => {
    if (initialExtraction) {
      setFieldMappings([{ extractedId: initialExtraction.id, extractedText: initialExtraction.text, targetEmployeeField: '' }]);
    }
  }, [initialExtraction]);

  return (
    <div className="employeeLinkModal p-4 bg-surface rounded-lg border border-border max-h-[80vh] overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Link Extracted Text to Employee</h3>
        <button className="modalCloseBtn" onClick={() => onClosed?.()}>✕</button>
      </div>
      
      <div className="employeeLinkContent" style={{ display: 'grid', gridTemplateColumns: '40% 60%', gap: 16, height: '65vh' }}>
        {/* Left: search + list (contained) */}
        <div className="leftCol flex flex-col">
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-2 py-2 border rounded text-sm mb-2"
          />
          <div className="modalEmployeeList flex-1 overflow-y-auto p-1">
            {loading ? (
              <div className="text-center py-6">Loading...</div>
            ) : filteredBySearch.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">No employees found.</div>
            ) : (
              filteredBySearch.map(emp => (
                <div key={emp.employeeid} className="modalEmployeeItem" onClick={() => setSelectedEmployee(emp)} style={{ cursor: 'pointer' }}>
                  <span style={{ width: 20 }} />
                  <div style={{ flex: 2 }}>
                    <div style={{ fontWeight: 600 }}>{emp.name}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>ID: {emp.employeeid} • {emp.position}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'right', fontSize: 12 }}>{emp.department}</div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Right: field mapping / preview */}
        <div className="rightCol flex flex-col">
          <div className="flex-1 overflow-y-auto p-2">
            {selectedEmployee ? (
              <>
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Map Fields
                </h4>

                <Card className="p-2 bg-muted/50">
                  <p className="text-xs text-muted-foreground">
                    {selectedEmployee.firstname} {selectedEmployee.lastname}
                  </p>
                </Card>

                {/* Active Field Mappings */}
                {fieldMappings.length > 0 && (
                  <div className="space-y-2 border rounded p-2 bg-amber-50/50">
                    {fieldMappings.map((mapping) => (
                      <div key={mapping.extractedId} className="space-y-1 p-2 border rounded bg-white">
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate" title={mapping.extractedText}>
                              {mapping.extractedText}
                            </p>
                            {mapping.targetEmployeeField && (
                              <Badge variant="outline" className="text-xs mt-1">
                                → {employeeFields.find(f => f.key === mapping.targetEmployeeField)?.label}
                              </Badge>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveFieldMapping(mapping.extractedId)}
                            className="text-muted-foreground hover:text-destructive flex-shrink-0"
                            title="Remove mapping"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        <select
                          value={mapping.targetEmployeeField}
                          onChange={(e) => handleFieldChange(mapping.extractedId, e.target.value)}
                          className="w-full text-xs border rounded p-1"
                        >
                          <option value="">Select target field...</option>
                          {employeeFields.map((field) => (
                            <option key={field.key} value={field.key}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {/* Available Extractions */}
                <div className="space-y-2">
                  <p className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                    <FileText className="w-3 h-3" />
                    Available Scanned Data ({getUnmappedExtractions().length})
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {getUnmappedExtractions().length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        All extractions mapped
                      </p>
                    ) : (
                      getUnmappedExtractions().map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleAddFieldMapping(item)}
                          className="w-full text-left p-2 border rounded text-xs hover:bg-muted transition"
                        >
                          <p className="truncate font-medium">{item.text}</p>
                          {item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 mt-1">
                              {item.tags.slice(0, 2).map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Select an employee to map fields</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="modalFooter mt-3">
        <Button onClick={() => onClosed?.()} variant="outline">Cancel</Button>
        <Button onClick={() => handleUpdateEmployee()} variant="default">Update Profile</Button>
      </div>
    </div>
  );
};