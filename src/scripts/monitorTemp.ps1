while($true) {
    $temp = Get-CimInstance -Namespace root/wmi -ClassName MsAcpi_ThermalZoneTemperature
    $celsius = ($temp.CurrentTemperature / 10) - 273.15
    Write-Output "CPU TEMP: $celsius C"
    Start-Sleep -Seconds 2
}
