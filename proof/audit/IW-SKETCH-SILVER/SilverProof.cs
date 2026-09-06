using System;using System.Drawing;using System.Drawing.Imaging;using System.Runtime.InteropServices;
public class SilverProof {
 [StructLayout(LayoutKind.Sequential)] public struct RECT {public int Left,Top,Right,Bottom;}
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c);
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h,int a,out uint v,int size);
 public static void Capture(IntPtr h,string path){RECT r;GetWindowRect(h,out r);using(var bitmap=new Bitmap(r.Right-r.Left,r.Bottom-r.Top)){using(var g=Graphics.FromImage(bitmap)){var dc=g.GetHdc();PrintWindow(h,dc,2);g.ReleaseHdc(dc);}bitmap.Save(path,ImageFormat.Png);}}
}
