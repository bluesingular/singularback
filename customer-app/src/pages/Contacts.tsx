import { BookUser } from "lucide-react";

export default function Contacts() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BookUser className="w-5 h-5 text-[#1A9E68]" />
        <h1 className="font-serif text-2xl text-[#1A1A1A]">Contacts</h1>
      </div>
      <div className="bg-white border border-[#E8E4DC] rounded-xl p-10 text-center">
        <BookUser className="w-8 h-8 text-[#D1C9BC] mx-auto mb-3" />
        <p className="text-sm font-medium text-[#1A1A1A]">Répertoire de contacts</p>
        <p className="text-xs text-[#6B6B6B] mt-1 max-w-xs mx-auto">
          Les contacts traités par vos agents apparaîtront ici automatiquement.
        </p>
      </div>
    </div>
  );
}
