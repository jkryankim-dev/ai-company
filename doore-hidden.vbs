' Start doore with no visible window.
' Put a shortcut of this file into shell:startup for auto-start on boot.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run "node runtime\supervisor.mjs", 0, False
