using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using ACadSharp;
using ACadSharp.IO;

// A single request per process. The desktop host bounds runtime and cancels by
// terminating this process. Drawing bytes never leave the local computer.
internal static class Converter
{
    const int Limit = 12000000;
    static int Main(string[] args)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        var warnings = new List<string>();
        NotificationEventHandler notify = (sender, e) => {
            string message = e.Message ?? "CAD translator warning.";
            if (warnings.Count < 25 && !warnings.Contains(message))
                warnings.Add(message.Substring(0, Math.Min(message.Length, 300)));
        };
        try
        {
            if (args.Length != 1 || (args[0] != "to-dwg" && args[0] != "to-dxf"))
                throw new InvalidOperationException("Choose DWG import or export.");
            byte[] bytes;
            using (var input = Console.OpenStandardInput())
            using (var buffer = new MemoryStream())
            {
                byte[] chunk = new byte[8192];
                int count;
                while ((count = input.Read(chunk, 0, chunk.Length)) > 0)
                {
                    if (buffer.Length + count > Limit) throw new InvalidOperationException("CAD file exceeds 12 MB.");
                    buffer.Write(chunk, 0, count);
                }
                bytes = buffer.ToArray();
            }
            if (bytes.Length < 6) throw new InvalidOperationException("CAD file is empty or incomplete.");
            bool export = args[0] == "to-dwg";
            CadDocument doc;
            using (var input = new MemoryStream(bytes))
                doc = export ? DxfReader.Read(input, notify) : DwgReader.Read(input, notify);
            if (doc.Entities.Count == 0 || doc.Entities.Count > 100000)
                throw new InvalidOperationException("CAD drawing must contain 1 to 100,000 model-space entities.");
            // Minimal ASCII DXF omits optional CAD defaults required by DWG.
            // Layer declarations come from the exporter, never guessed here.
            if (export) doc.CreateDefaults();
            int units = (int)doc.Header.InsUnits;
            if (!new[] { 1, 2, 4, 5, 6 }.Contains(units))
                throw new InvalidOperationException("CAD file must declare millimetres, centimetres, metres, inches or feet.");
            byte[] converted;
            using (var output = new MemoryStream())
            {
                if (export) DwgWriter.Write(output, doc, new DwgWriterConfiguration(), notify);
                else DxfWriter.Write(output, doc, false, new DxfWriterConfiguration(), notify);
                converted = output.ToArray();
            }
            if (converted.Length == 0 || converted.Length > Limit)
                throw new InvalidOperationException("Converted CAD file exceeds 12 MB or is empty.");
            Write(new {
                ok = true, format = export ? "dwg" : "dxf",
                bytesBase64 = Convert.ToBase64String(converted),
                entityCount = doc.Entities.Count, units = units,
                warnings = warnings.ToArray(), translator = "ACadSharp 3.7.1",
            });
            return 0;
        }
        catch (Exception e)
        {
            string message = e is InvalidOperationException ? e.Message : "CAD conversion failed. The drawing may be damaged or use unsupported entities or a DWG version.";
            Write(new { ok = false, error = message, warnings = warnings.ToArray() });
            return 1;
        }
    }
    static void Write(object value)
    {
        Console.WriteLine(new JavaScriptSerializer { MaxJsonLength = 24000000 }.Serialize(value));
    }
}
