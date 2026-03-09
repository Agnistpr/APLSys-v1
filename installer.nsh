!include nsDialogs.nsh
!include LogicLib.nsh

Var ScanDataDir

!macro customPages
  Page custom ScanDirPage ScanDirPageLeave
!macroend

!macro customInstall
  ; Store the selected directory for the app to read
  WriteRegStr HKCU "Software\APLSys" "ScanDataDir" "$ScanDataDir"
  MessageBox MB_OK "Install directory saved: $ScanDataDir"
!macroend

!macro customUnInstall
  ; Clean up registry on uninstall if needed
  DeleteRegKey HKCU "Software\APLSys"
!macroend

Function ScanDirPage
  nsDialogs::Create 1018
  Pop $0

  ${NSD_CreateLabel} 0 0 100% 12u \
    "Choose a folder where scanned and pending files will be stored:"
  Pop $1

  ${NSD_CreateDirRequest} 0 18u 80% 12u \
    "$DOCUMENTS\APLSysScans"
  Pop $ScanDataDir

  ${NSD_CreateBrowseButton} 82% 18u 18% 12u "Browse..."
  Pop $2

  ${NSD_OnClick} $2 BrowseScanDir

  nsDialogs::Show
FunctionEnd

Function BrowseScanDir
  nsDialogs::SelectFolderDialog \
    "Select Scan Data Folder" \
    "$DOCUMENTS"
  Pop $0
  ${If} $0 != error
    ${NSD_SetText} $ScanDataDir $0
  ${EndIf}
FunctionEnd

Function ScanDirPageLeave
  ${NSD_GetText} $ScanDataDir $ScanDataDir
FunctionEnd

!insertmacro customPages